-- Durable extraction reviews and append-only state changes for facts.

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS extraction_payload jsonb,
  ADD COLUMN IF NOT EXISTS candidate_payload jsonb,
  ADD COLUMN IF NOT EXISTS event_time time;

ALTER TABLE facts
  ADD COLUMN IF NOT EXISTS valid_time_start timestamptz,
  ADD COLUMN IF NOT EXISTS valid_time_end timestamptz,
  ADD COLUMN IF NOT EXISTS supersedes_fact_id uuid REFERENCES facts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS facts_active_entity_key_idx
  ON facts (user_id, entity_id, key, learned_at DESC)
  WHERE invalidated_at IS NULL;

-- Preserve any old duplicate rows as history, but leave one active value for
-- each state key so future corrections have an unambiguous predecessor.
WITH ranked_active_facts AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, entity_id, key, value
           ORDER BY learned_at DESC NULLS LAST, id DESC
         ) AS active_rank
  FROM facts
  WHERE invalidated_at IS NULL
)
UPDATE facts AS f
SET invalidated_at = now(),
    valid_to = COALESCE(f.valid_to, CURRENT_DATE)
FROM ranked_active_facts AS ranked
WHERE ranked.id = f.id
  AND ranked.active_rank > 1;

CREATE OR REPLACE FUNCTION record_fact_assertion(
  p_entity_id uuid,
  p_key text,
  p_value text,
  p_entry_id uuid DEFAULT NULL,
  p_valid_time_start timestamptz DEFAULT NULL
)
RETURNS SETOF facts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_previous facts%ROWTYPE;
  v_new facts%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_key IS NULL OR btrim(p_key) = '' OR p_value IS NULL THEN
    RAISE EXCEPTION 'Fact key and value are required' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM entities e
  WHERE e.id = p_entity_id AND e.user_id = v_user_id AND e.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entity not found for current user' USING ERRCODE = '42501';
  END IF;

  IF p_entry_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM entries e WHERE e.id = p_entry_id AND e.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Entry does not belong to current user' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_previous
  FROM facts f
  WHERE f.user_id = v_user_id
    AND f.entity_id = p_entity_id
    AND f.key = p_key
    AND f.invalidated_at IS NULL
  ORDER BY f.learned_at DESC NULLS LAST, f.id DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND v_previous.value = p_value THEN
    UPDATE facts
    SET invalidated_at = v_now,
        valid_to = COALESCE(valid_to, CURRENT_DATE)
    WHERE user_id = v_user_id
      AND entity_id = p_entity_id
      AND key = p_key
      AND invalidated_at IS NULL
      AND id <> v_previous.id;
    RETURN QUERY SELECT v_previous.*;
    RETURN;
  END IF;

  IF FOUND THEN
    UPDATE facts
    SET invalidated_at = v_now,
        valid_to = COALESCE(p_valid_time_start::date, CURRENT_DATE),
        valid_time_end = COALESCE(p_valid_time_start, v_now)
    WHERE user_id = v_user_id
      AND entity_id = p_entity_id
      AND key = p_key
      AND invalidated_at IS NULL;
  END IF;

  INSERT INTO facts (
    user_id, entity_id, key, value, entry_id, as_of,
    valid_from, learned_at, valid_time_start, supersedes_fact_id
  ) VALUES (
    v_user_id, p_entity_id, p_key, p_value, p_entry_id,
    COALESCE(p_valid_time_start::date, CURRENT_DATE),
    COALESCE(p_valid_time_start::date, CURRENT_DATE),
    v_now, p_valid_time_start,
    CASE WHEN v_previous.id IS NOT NULL THEN v_previous.id ELSE NULL END
  )
  RETURNING * INTO v_new;

  RETURN QUERY SELECT v_new.*;
END;
$$;

REVOKE ALL ON FUNCTION record_fact_assertion(uuid, text, text, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_fact_assertion(uuid, text, text, uuid, timestamptz) TO authenticated;
