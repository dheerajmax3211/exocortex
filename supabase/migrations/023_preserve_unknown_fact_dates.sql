-- Do not invent a valid-time date when the source does not establish one.
-- learned_at/invalidated_at continue to record when the system learned or
-- superseded an assertion; valid_from/valid_to describe source-grounded time.
CREATE OR REPLACE FUNCTION record_fact_assertion(
  p_entity_id uuid,
  p_key text,
  p_value text,
  p_entry_id uuid DEFAULT NULL,
  p_valid_time_start timestamptz DEFAULT NULL,
  p_supersedes_fact_id uuid DEFAULT NULL,
  p_valid_from_date date DEFAULT NULL,
  p_valid_time_precision text DEFAULT NULL
)
RETURNS SETOF facts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_valid_date date := COALESCE(
    p_valid_from_date,
    (p_valid_time_start AT TIME ZONE 'Asia/Kolkata')::date
  );
  v_precision text;
  v_previous facts%ROWTYPE;
  v_new facts%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_key IS NULL OR btrim(p_key) = '' OR p_value IS NULL THEN
    RAISE EXCEPTION 'Fact key and value are required' USING ERRCODE = '22023';
  END IF;
  IF p_valid_time_precision IS NOT NULL AND p_valid_time_precision NOT IN ('exact', 'approximate', 'date_only', 'unknown') THEN
    RAISE EXCEPTION 'Invalid valid-time precision' USING ERRCODE = '22023';
  END IF;
  IF p_valid_time_start IS NOT NULL AND p_valid_time_precision IN ('approximate', 'date_only') THEN
    RAISE EXCEPTION 'Approximate or date-only facts cannot have an exact valid-time timestamp' USING ERRCODE = '22023';
  END IF;
  IF p_valid_time_start IS NULL AND p_valid_time_precision = 'exact' THEN
    RAISE EXCEPTION 'Exact time precision requires a valid-time timestamp' USING ERRCODE = '22023';
  END IF;

  v_precision := CASE
    WHEN p_valid_time_precision IS NOT NULL AND p_valid_time_precision <> 'unknown'
      THEN p_valid_time_precision
    ELSE CASE
      WHEN p_valid_time_start IS NOT NULL THEN 'exact'
      WHEN p_value ~* '(^|[^[:alpha:]])(around|about|approximately|approx\.?|roughly|between|sometime around)[^[:digit:]]{0,32}[[:digit:]]{1,2}([:.][[:digit:]]{2})?[[:space:]]*(a\.?m\.?|p\.?m\.?)([^[:alpha:]]|$)' THEN 'approximate'
      WHEN p_value ~* '(^|[^[:alpha:]])(around|about|approximately|approx\.?|roughly|sometime|after|before)[^[:alpha:]]{0,24}(noon|midday|midnight|lunch|dinner)([^[:alpha:]]|$)' THEN 'approximate'
      WHEN p_valid_from_date IS NOT NULL THEN 'date_only'
      ELSE 'unknown'
    END
  END;

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
      SELECT * INTO v_new
      FROM facts f
      WHERE f.user_id = v_user_id
        AND f.entity_id = p_entity_id
        AND f.key = p_key
        AND f.value = p_value
        AND f.entry_id IS NOT DISTINCT FROM p_entry_id
        AND f.supersedes_fact_id = p_supersedes_fact_id
      ORDER BY f.learned_at DESC NULLS LAST, f.id DESC
      LIMIT 1;
      IF FOUND THEN
        RETURN QUERY SELECT v_new.*;
        RETURN;
      END IF;
      RAISE EXCEPTION 'Fact selected for correction is not an active assertion for this entity/key' USING ERRCODE = '22023';
    END IF;

    IF v_previous.value = p_value THEN
      RETURN QUERY SELECT v_previous.*;
      RETURN;
    END IF;

    UPDATE facts
    SET invalidated_at = v_now,
        valid_to = v_valid_date,
        valid_time_end = p_valid_time_start
    WHERE id = v_previous.id AND user_id = v_user_id;
  ELSE
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
    valid_from, learned_at, valid_time_start, supersedes_fact_id,
    valid_time_precision
  ) VALUES (
    v_user_id, p_entity_id, p_key, p_value, p_entry_id,
    v_valid_date, v_valid_date,
    v_now, p_valid_time_start,
    CASE WHEN p_supersedes_fact_id IS NOT NULL THEN v_previous.id ELSE NULL END,
    v_precision
  )
  RETURNING * INTO v_new;

  RETURN QUERY SELECT v_new.*;
END;
$$;

REVOKE ALL ON FUNCTION record_fact_assertion(uuid, text, text, uuid, timestamptz, uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_fact_assertion(uuid, text, text, uuid, timestamptz, uuid, date, text) TO authenticated;
