-- Keep extraction fact context bounded without allowing recent assertions for
-- a few entities to crowd all history for older but relevant candidates out.
CREATE INDEX IF NOT EXISTS facts_active_entity_learned_idx
  ON facts (user_id, entity_id, learned_at DESC NULLS LAST, id DESC)
  WHERE invalidated_at IS NULL;

CREATE OR REPLACE FUNCTION get_current_facts_for_entities(
  p_entity_ids uuid[],
  p_per_entity_limit integer DEFAULT 2
)
RETURNS TABLE (
  id uuid,
  entity_id uuid,
  key text,
  value text,
  valid_from date,
  valid_to date,
  valid_time_start timestamptz,
  valid_time_precision text,
  learned_at timestamptz,
  entry_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(cardinality(p_entity_ids), 0) > 100 THEN
    RAISE EXCEPTION 'Candidate entity list exceeds supported bounds' USING ERRCODE = '22023';
  END IF;
  IF p_per_entity_limit IS NULL OR p_per_entity_limit < 1 OR p_per_entity_limit > 10 THEN
    RAISE EXCEPTION 'Per-entity fact limit is outside supported bounds' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH requested AS (
    SELECT DISTINCT requested_ids.entity_id
    FROM unnest(COALESCE(p_entity_ids, '{}'::uuid[])) AS requested_ids(entity_id)
  )
  SELECT current_facts.id, current_facts.entity_id, current_facts.key,
         current_facts.value, current_facts.valid_from, current_facts.valid_to,
         current_facts.valid_time_start, current_facts.valid_time_precision,
         current_facts.learned_at, current_facts.entry_id
  FROM requested r
  JOIN entities e ON e.id = r.entity_id
    AND e.user_id = v_user_id AND e.deleted_at IS NULL
  CROSS JOIN LATERAL (
    SELECT f.id, f.entity_id, f.key, f.value, f.valid_from, f.valid_to,
           f.valid_time_start, f.valid_time_precision, f.learned_at, f.entry_id
    FROM facts f
    WHERE f.entity_id = e.id
      AND f.user_id = v_user_id
      AND f.invalidated_at IS NULL
    ORDER BY f.learned_at DESC NULLS LAST, f.id DESC
    LIMIT p_per_entity_limit
  ) AS current_facts
  ORDER BY current_facts.learned_at DESC NULLS LAST, current_facts.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_current_facts_for_entities(uuid[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_current_facts_for_entities(uuid[], integer) TO authenticated;

-- Return a small, fair sample of nearby assertions for every candidate and
-- include endpoint names even when the other endpoint was not a candidate.
CREATE INDEX IF NOT EXISTS edges_active_src_context_idx
  ON edges (user_id, src, created_at DESC NULLS LAST, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS edges_active_dst_context_idx
  ON edges (user_id, dst, created_at DESC NULLS LAST, id DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION get_candidate_edges_for_entities(
  p_entity_ids uuid[],
  p_per_entity_limit integer DEFAULT 3
)
RETURNS TABLE (
  edge_id uuid,
  anchor_entity_id uuid,
  src uuid,
  dst uuid,
  relation text,
  src_name text,
  dst_name text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(cardinality(p_entity_ids), 0) > 100 THEN
    RAISE EXCEPTION 'Candidate entity list exceeds supported bounds' USING ERRCODE = '22023';
  END IF;
  IF p_per_entity_limit IS NULL OR p_per_entity_limit < 1 OR p_per_entity_limit > 5 THEN
    RAISE EXCEPTION 'Per-entity edge limit is outside supported bounds' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH requested AS (
    SELECT DISTINCT requested_ids.entity_id
    FROM unnest(COALESCE(p_entity_ids, '{}'::uuid[])) AS requested_ids(entity_id)
  )
  SELECT DISTINCT ON (edge_sample.id)
         edge_sample.id,
         candidate.id,
         edge_sample.src,
         edge_sample.dst,
         edge_sample.relation,
         src_entity.name,
         dst_entity.name
  FROM requested r
  JOIN entities candidate ON candidate.id = r.entity_id
    AND candidate.user_id = v_user_id AND candidate.deleted_at IS NULL
  CROSS JOIN LATERAL (
    SELECT ed.id, ed.src, ed.dst, ed.relation, ed.created_at
    FROM edges ed
    WHERE ed.user_id = v_user_id
      AND ed.deleted_at IS NULL
      AND (ed.src = candidate.id OR ed.dst = candidate.id)
    ORDER BY ed.created_at DESC NULLS LAST, ed.id DESC
    LIMIT p_per_entity_limit
  ) AS edge_sample
  JOIN entities src_entity ON src_entity.id = edge_sample.src
    AND src_entity.user_id = v_user_id AND src_entity.deleted_at IS NULL
  JOIN entities dst_entity ON dst_entity.id = edge_sample.dst
    AND dst_entity.user_id = v_user_id AND dst_entity.deleted_at IS NULL
  ORDER BY edge_sample.id, (edge_sample.src = candidate.id) DESC, candidate.id;
END;
$$;

REVOKE ALL ON FUNCTION get_candidate_edges_for_entities(uuid[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_candidate_edges_for_entities(uuid[], integer) TO authenticated;
