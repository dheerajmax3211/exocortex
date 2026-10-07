-- Persist model-provided time precision in the same transaction as the graph
-- commit. The inner RPC remains attempt-fenced; this narrow wrapper only adds
-- validation and a user/entry-scoped precision update after the graph writes.
CREATE OR REPLACE FUNCTION commit_entry_graph_atomic_with_precision(
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
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_fact_precision text;
  v_valid_time_start timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(COALESCE(p_facts, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_facts, '[]'::jsonb)) > 1000 THEN
    RAISE EXCEPTION 'Fact payload exceeds supported bounds' USING ERRCODE = '22023';
  END IF;

  -- The inner SECURITY INVOKER RPC validates ownership for every write and
  -- requires the current user's exact commit attempt. As this function owner,
  -- this wrapper can call the inner RPC after its direct authenticated grant is
  -- revoked; auth.uid() continues to identify the caller from the JWT.
  PERFORM commit_entry_graph_atomic(
    p_entry_id,
    p_commit_attempt,
    p_new_entities,
    p_entity_updates,
    p_entity_ids,
    p_parent_links,
    p_edges,
    p_facts,
    p_event_date,
    p_event_time,
    p_date_end,
    p_date_precision
  );

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_facts, '[]'::jsonb)) LOOP
    v_fact_precision := NULLIF(v_item->>'valid_time_precision', '');
    IF v_fact_precision IS NULL OR v_fact_precision = 'unknown' THEN
      CONTINUE; -- Keep the precision inferred by record_fact_assertion.
    END IF;
    IF v_fact_precision NOT IN ('exact', 'approximate', 'date_only') THEN
      RAISE EXCEPTION 'Invalid fact time precision' USING ERRCODE = '22023';
    END IF;

    v_valid_time_start := NULLIF(v_item->>'valid_time_start', '')::timestamptz;
    IF (v_fact_precision = 'exact' AND v_valid_time_start IS NULL)
       OR (v_fact_precision IN ('approximate', 'date_only') AND v_valid_time_start IS NOT NULL) THEN
      RAISE EXCEPTION 'Fact time precision conflicts with its timestamp' USING ERRCODE = '22023';
    END IF;

    UPDATE facts f SET valid_time_precision = v_fact_precision
    WHERE f.user_id = v_user_id
      AND f.entry_id = p_entry_id
      AND f.entity_id = (v_item->>'entity_id')::uuid
      AND f.key = v_item->>'key'
      AND f.value = v_item->>'value'
      AND f.invalidated_at IS NULL;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION commit_entry_graph_atomic_with_precision(uuid, integer, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, date, time, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION commit_entry_graph_atomic_with_precision(uuid, integer, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, date, time, date, text) TO authenticated;

-- All server commits now go through the wrapper so an invalid/missing precision
-- update can never leave the graph committed but its temporal metadata stale.
REVOKE ALL ON FUNCTION commit_entry_graph_atomic(uuid, integer, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, date, time, date, text) FROM PUBLIC, anon, authenticated;
