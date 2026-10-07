-- Atomically persist the assertion/link portion of a reviewed graph commit.
CREATE OR REPLACE FUNCTION commit_entry_graph_writes(
  p_entry_id uuid,
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
  v_entry_owner uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT e.user_id INTO v_entry_owner
  FROM entries e
  WHERE e.id = p_entry_id AND e.user_id = v_user_id AND e.status = 'committing'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entry is not owned by current user or not claimed for commit' USING ERRCODE = '42501';
  END IF;

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

    -- Retries of this entry reuse its existing assertion. Different source
    -- entries remain distinct observations even when endpoints/relation match.
    IF NOT EXISTS (
      SELECT 1 FROM edges e
      WHERE e.user_id = v_user_id
        AND e.entry_id = p_entry_id
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
    SELECT 1
    FROM unnest(COALESCE(p_entity_ids, '{}'::uuid[])) AS linked_entities(linked_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = linked_id AND e.user_id = v_user_id AND e.deleted_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Entry link contains an entity outside the current user's active graph' USING ERRCODE = '42501';
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
  WHERE id = p_entry_id AND user_id = v_user_id AND status = 'committing';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commit lease was lost before finalization' USING ERRCODE = '40001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION commit_entry_graph_writes(uuid, uuid[], jsonb, jsonb, jsonb, date, time, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION commit_entry_graph_writes(uuid, uuid[], jsonb, jsonb, jsonb, date, time, date, text) TO authenticated;
