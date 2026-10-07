-- Fact keys can be multi-valued. Only supersede a prior assertion when the
-- extractor explicitly identifies the fact being corrected.
DROP FUNCTION IF EXISTS record_fact_assertion(uuid, text, text, uuid, timestamptz);

CREATE OR REPLACE FUNCTION record_fact_assertion(
  p_entity_id uuid,
  p_key text,
  p_value text,
  p_entry_id uuid DEFAULT NULL,
  p_valid_time_start timestamptz DEFAULT NULL,
  p_supersedes_fact_id uuid DEFAULT NULL
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

  IF p_supersedes_fact_id IS NOT NULL THEN
    SELECT * INTO v_previous
    FROM facts f
    WHERE f.id = p_supersedes_fact_id
      AND f.user_id = v_user_id
      AND f.entity_id = p_entity_id
      AND f.key = p_key
      AND f.invalidated_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fact selected for correction is not an active assertion for this entity/key' USING ERRCODE = '22023';
    END IF;

    IF v_previous.value = p_value THEN
      RETURN QUERY SELECT v_previous.*;
      RETURN;
    END IF;

    UPDATE facts
    SET invalidated_at = v_now,
        valid_to = COALESCE(p_valid_time_start::date, CURRENT_DATE),
        valid_time_end = COALESCE(p_valid_time_start, v_now)
    WHERE id = v_previous.id AND user_id = v_user_id;
  ELSE
    -- An exact retry from the same source entry is idempotent; repeated
    -- assertions from separate entries retain their separate provenance.
    SELECT * INTO v_previous
    FROM facts f
    WHERE f.user_id = v_user_id
      AND f.entity_id = p_entity_id
      AND f.key = p_key
      AND f.value = p_value
      AND f.entry_id IS NOT DISTINCT FROM p_entry_id
      AND f.invalidated_at IS NULL
    ORDER BY f.learned_at DESC NULLS LAST, f.id DESC
    LIMIT 1
    FOR UPDATE;
    IF FOUND THEN
      RETURN QUERY SELECT v_previous.*;
      RETURN;
    END IF;
  END IF;

  INSERT INTO facts (
    user_id, entity_id, key, value, entry_id, as_of,
    valid_from, learned_at, valid_time_start, supersedes_fact_id
  ) VALUES (
    v_user_id, p_entity_id, p_key, p_value, p_entry_id,
    COALESCE(p_valid_time_start::date, CURRENT_DATE),
    COALESCE(p_valid_time_start::date, CURRENT_DATE),
    v_now, p_valid_time_start,
    CASE WHEN p_supersedes_fact_id IS NOT NULL THEN v_previous.id ELSE NULL END
  )
  RETURNING * INTO v_new;

  RETURN QUERY SELECT v_new.*;
END;
$$;

REVOKE ALL ON FUNCTION record_fact_assertion(uuid, text, text, uuid, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_fact_assertion(uuid, text, text, uuid, timestamptz, uuid) TO authenticated;
