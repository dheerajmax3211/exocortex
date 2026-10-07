-- Make graph search RPCs obey caller RLS. These routines accept user IDs for
-- compatibility, but SECURITY INVOKER ensures those IDs cannot bypass policies.
ALTER FUNCTION search_entities(text, vector, double precision, uuid) SECURITY INVOKER;
ALTER FUNCTION search_entities(text, vector, double precision, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION entity_neighborhood(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION entity_neighborhood(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION list_by_relation(uuid, text, uuid) SECURITY INVOKER;
ALTER FUNCTION list_by_relation(uuid, text, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION hybrid_graph_search(vector, uuid, integer, double precision) SECURITY INVOKER;
ALTER FUNCTION hybrid_graph_search(vector, uuid, integer, double precision) SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION search_entities(text, vector, double precision, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION entity_neighborhood(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION list_by_relation(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION hybrid_graph_search(vector, uuid, integer, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION search_entities(text, vector, double precision, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION entity_neighborhood(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION list_by_relation(uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION hybrid_graph_search(vector, uuid, integer, double precision) TO authenticated, service_role;

-- Duplicate detection is a maintenance-only operation. Even for the service
-- role, compare nodes only within one account and never pair different users.
CREATE OR REPLACE FUNCTION find_duplicate_entities(
  p_similarity_threshold double precision DEFAULT 0.98,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  target_id uuid,
  source_id uuid,
  target_name text,
  source_name text,
  similarity double precision
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT e1.id,
         e2.id,
         e1.name,
         e2.name,
         (1 - (e1.embedding <=> e2.embedding))::double precision
  FROM entities e1
  JOIN entities e2
    ON e1.user_id = e2.user_id
   AND e1.id < e2.id
   AND e1.type = e2.type
  WHERE (p_user_id IS NULL OR e1.user_id = p_user_id)
    AND e1.deleted_at IS NULL
    AND e2.deleted_at IS NULL
    AND e1.embedding IS NOT NULL
    AND e2.embedding IS NOT NULL
    AND (1 - (e1.embedding <=> e2.embedding)) > p_similarity_threshold
  ORDER BY similarity DESC;
$$;

REVOKE ALL ON FUNCTION find_duplicate_entities(double precision, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION find_duplicate_entities(double precision, uuid) TO service_role;

-- The state ledger has no direct client policy. Keep its mutation behind this
-- narrow function and bind both entity and source entry to the caller.
ALTER TABLE entity_state_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entity_state_ledger_select ON entity_state_ledger;
DROP POLICY IF EXISTS entity_state_ledger_insert ON entity_state_ledger;
DROP POLICY IF EXISTS entity_state_ledger_update ON entity_state_ledger;
DROP POLICY IF EXISTS entity_state_ledger_delete ON entity_state_ledger;
CREATE POLICY entity_state_ledger_select ON entity_state_ledger
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY entity_state_ledger_insert ON entity_state_ledger
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY entity_state_ledger_update ON entity_state_ledger
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY entity_state_ledger_delete ON entity_state_ledger
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION mutate_entity_state(
  p_entity_id uuid,
  p_new_props jsonb,
  p_entry_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT e.user_id INTO v_user_id
  FROM entities e
  WHERE e.id = p_entity_id
    AND e.deleted_at IS NULL
    AND (auth.role() = 'service_role' OR e.user_id = auth.uid())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entity not found for current user' USING ERRCODE = '42501';
  END IF;

  IF p_entry_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM entries e WHERE e.id = p_entry_id AND e.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Entry does not belong to entity owner' USING ERRCODE = '42501';
  END IF;

  UPDATE entity_state_ledger
  SET valid_to = v_now
  WHERE entity_id = p_entity_id
    AND user_id = v_user_id
    AND valid_to IS NULL;

  INSERT INTO entity_state_ledger (user_id, entity_id, props, valid_from, valid_to, entry_id)
  VALUES (v_user_id, p_entity_id, COALESCE(p_new_props, '{}'::jsonb), v_now, NULL, p_entry_id);

  UPDATE entities
  SET props = COALESCE(p_new_props, '{}'::jsonb)
  WHERE id = p_entity_id AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION mutate_entity_state(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mutate_entity_state(uuid, jsonb, uuid) TO authenticated, service_role;

-- This analytics function runs as the caller, so table RLS scopes its result.
REVOKE ALL ON FUNCTION compute_graph_centrality(uuid, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION compute_graph_centrality(uuid, double precision, integer) TO authenticated, service_role;
