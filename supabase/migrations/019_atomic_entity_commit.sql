-- Move entity inserts and updates into the graph-write transaction. Also fence
-- a commit worker by its attempt number so an expired worker cannot commit
-- after a later request has reclaimed the entry lease.
CREATE OR REPLACE FUNCTION commit_entry_graph_atomic(
  p_entry_id uuid,
  p_commit_attempt integer,
  p_new_entities jsonb,
  p_entity_updates jsonb,
  p_entity_ids uuid[],
  p_parent_links jsonb,
  p_edges jsonb,
  p_facts jsonb,
  p_event_date date DEFAULT NULL,
  p_event_time time DEFAULT NULL,
  p_date_end date DEFAULT NULL,
  p_date_precision text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_entity_id uuid;
  v_parent_id uuid;
  v_src uuid;
  v_dst uuid;
  v_relation text;
  v_props jsonb;
  v_entry_attempt integer;
  v_name text;
  v_existing_props jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT e.commit_attempt INTO v_entry_attempt
  FROM entries e
  WHERE e.id = p_entry_id AND e.user_id = v_user_id AND e.status = 'committing'
  FOR UPDATE;
  IF NOT FOUND OR v_entry_attempt IS DISTINCT FROM p_commit_attempt THEN
    RAISE EXCEPTION 'Entry commit lease is not owned by this attempt' USING ERRCODE = '40001';
  END IF;

  IF jsonb_typeof(COALESCE(p_new_entities, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(COALESCE(p_entity_updates, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Entity writes must be JSON arrays' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(COALESCE(p_new_entities, '[]'::jsonb)) > 300
     OR jsonb_array_length(COALESCE(p_entity_updates, '[]'::jsonb)) > 301
     OR jsonb_array_length(COALESCE(p_parent_links, '[]'::jsonb)) > 300
     OR jsonb_array_length(COALESCE(p_edges, '[]'::jsonb)) > 1000
     OR jsonb_array_length(COALESCE(p_facts, '[]'::jsonb)) > 1000
     OR cardinality(COALESCE(p_entity_ids, '{}'::uuid[])) > 500 THEN
    RAISE EXCEPTION 'Graph commit payload exceeds supported bounds' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_new_entities, '[]'::jsonb)) LOOP
    v_entity_id := (v_item->>'id')::uuid;
    v_name := NULLIF(btrim(v_item->>'name'), '');
    IF v_name IS NULL OR length(v_name) > 500 OR v_item->>'type' IS NULL
       OR v_item->>'type' NOT IN ('person', 'place', 'restaurant', 'dish', 'movie', 'show', 'book', 'school', 'org', 'period', 'event', 'item', 'other')
       OR jsonb_typeof(COALESCE(v_item->'aliases', '[]'::jsonb)) <> 'array'
       OR jsonb_typeof(COALESCE(v_item->'props', '{}'::jsonb)) <> 'object' THEN
      RAISE EXCEPTION 'New entity payload is invalid' USING ERRCODE = '22023';
    END IF;
    INSERT INTO entities (
      id, user_id, type, name, aliases, summary, props, created_from_entry, embedding
    ) VALUES (
      v_entity_id,
      v_user_id,
      v_item->>'type',
      v_name,
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_item->'aliases', '[]'::jsonb))),
      NULLIF(v_item->>'summary', ''),
      COALESCE(v_item->'props', '{}'::jsonb),
      p_entry_id,
      NULL
    );
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_entity_updates, '[]'::jsonb)) LOOP
    v_entity_id := (v_item->>'entity_id')::uuid;
    SELECT e.props INTO v_existing_props FROM entities e
    WHERE e.id = v_entity_id AND e.user_id = v_user_id AND e.deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entity update targets an entity outside the current user graph' USING ERRCODE = '42501';
    END IF;
    IF v_item ? 'aliases' AND jsonb_typeof(v_item->'aliases') <> 'array' THEN
      RAISE EXCEPTION 'Entity aliases must be an array' USING ERRCODE = '22023';
    END IF;
    IF v_item ? 'props' AND jsonb_typeof(v_item->'props') <> 'object' THEN
      RAISE EXCEPTION 'Entity props must be an object' USING ERRCODE = '22023';
    END IF;

    UPDATE entities SET
      name = CASE WHEN v_item ? 'name' THEN NULLIF(btrim(v_item->>'name'), '') ELSE name END,
      aliases = CASE WHEN v_item ? 'aliases'
        THEN ARRAY(SELECT DISTINCT a.value
          FROM unnest(entities.aliases || ARRAY(SELECT jsonb_array_elements_text(v_item->'aliases'))) AS a(value))
        ELSE aliases END,
      summary = CASE WHEN v_item ? 'summary' THEN NULLIF(v_item->>'summary', '') ELSE summary END,
      start_date = CASE WHEN v_item ? 'start_date' THEN NULLIF(v_item->>'start_date', '')::date ELSE start_date END,
      end_date = CASE WHEN v_item ? 'end_date' THEN NULLIF(v_item->>'end_date', '')::date ELSE end_date END
    WHERE id = v_entity_id AND user_id = v_user_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Entity changed or was deleted during commit' USING ERRCODE = '40001';
    END IF;

    IF v_item ? 'props' THEN
      v_props := COALESCE(v_existing_props, '{}'::jsonb) || v_item->'props';
      PERFORM mutate_entity_state(v_entity_id, v_props, p_entry_id);
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_parent_links, '[]'::jsonb)) LOOP
    v_entity_id := (v_item->>'entity_id')::uuid;
    v_parent_id := (v_item->>'parent_id')::uuid;
    IF v_entity_id = v_parent_id OR NOT EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = v_entity_id AND e.user_id = v_user_id AND e.deleted_at IS NULL
    ) OR NOT EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = v_parent_id AND e.user_id = v_user_id AND e.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Parent context link contains an invalid entity' USING ERRCODE = '42501';
    END IF;
    UPDATE entities SET parent_context_id = v_parent_id
    WHERE id = v_entity_id AND user_id = v_user_id AND deleted_at IS NULL;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_edges, '[]'::jsonb)) LOOP
    v_src := (v_item->>'src')::uuid;
    v_dst := (v_item->>'dst')::uuid;
    v_relation := NULLIF(v_item->>'relation', '');
    v_props := COALESCE(v_item->'props', '{}'::jsonb);
    IF v_src = v_dst OR v_relation IS NULL OR NOT EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = v_src AND e.user_id = v_user_id AND e.deleted_at IS NULL
    ) OR NOT EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = v_dst AND e.user_id = v_user_id AND e.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Edge contains an invalid entity or relation' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM edges e
      WHERE e.user_id = v_user_id AND e.entry_id = p_entry_id
        AND e.src = v_src AND e.dst = v_dst AND e.relation = v_relation
    ) THEN
      INSERT INTO edges (
        user_id, src, dst, relation, props, entry_id, occurred_on,
        valid_from, learned_at
      ) VALUES (
        v_user_id, v_src, v_dst, v_relation, v_props, p_entry_id,
        NULLIF(v_item->>'occurred_on', '')::date,
        NULLIF(v_item->>'valid_from', '')::date,
        COALESCE(NULLIF(v_item->>'learned_at', '')::timestamptz, clock_timestamp())
      );
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_facts, '[]'::jsonb)) LOOP
    PERFORM 1 FROM record_fact_assertion(
      (v_item->>'entity_id')::uuid,
      v_item->>'key',
      v_item->>'value',
      p_entry_id,
      NULLIF(v_item->>'valid_time_start', '')::timestamptz,
      NULLIF(v_item->>'supersedes_fact_id', '')::uuid,
      NULLIF(v_item->>'valid_from', '')::date
    );
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_entity_ids, '{}'::uuid[])) AS linked_entities(linked_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = linked_id AND e.user_id = v_user_id AND e.deleted_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Entry link contains an entity outside the current user graph' USING ERRCODE = '42501';
  END IF;

  INSERT INTO entry_entities(entry_id, entity_id)
  SELECT p_entry_id, linked_id
  FROM unnest(COALESCE(p_entity_ids, '{}'::uuid[])) AS linked_entities(linked_id)
  ON CONFLICT (entry_id, entity_id) DO NOTHING;

  UPDATE entries SET
    status = 'committed',
    commit_started_at = NULL,
    commit_prior_status = NULL,
    event_date = p_event_date,
    event_time = p_event_time,
    date_end = p_date_end,
    date_precision = COALESCE(p_date_precision, CASE WHEN p_event_date IS NULL THEN 'unknown' ELSE 'day' END)
  WHERE id = p_entry_id AND user_id = v_user_id
    AND status = 'committing' AND commit_attempt = p_commit_attempt;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commit lease was lost before finalization' USING ERRCODE = '40001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION commit_entry_graph_atomic(uuid, integer, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, date, time, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION commit_entry_graph_atomic(uuid, integer, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, date, time, date, text) TO authenticated;

-- Disable the unfenced assertion-only entry point from migration 018 so an
-- older route cannot commit after another request has reclaimed its lease.
REVOKE ALL ON FUNCTION commit_entry_graph_writes(uuid, uuid[], jsonb, jsonb, jsonb, date, time, date, text) FROM PUBLIC, anon, authenticated;
