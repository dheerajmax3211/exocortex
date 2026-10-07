-- Consume each quiz attempt and update its spaced-repetition schedule as one
-- transaction. A failed schedule write leaves the quiz session usable.
CREATE OR REPLACE FUNCTION grade_quiz_session(
  p_session_id uuid,
  p_user_id uuid,
  p_is_correct boolean
)
RETURNS TABLE (
  correct boolean,
  correct_answer text,
  next_review timestamptz,
  interval_days integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session quiz_sessions%ROWTYPE;
  v_review reviews%ROWTYPE;
  v_ease double precision;
  v_interval integer;
  v_repetitions integer;
  v_next_review timestamptz;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_user_id IS NULL OR p_is_correct IS NULL THEN
    RAISE EXCEPTION 'User and grading result are required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session
  FROM quiz_sessions
  WHERE id = p_session_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz session not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_session.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Quiz session was already submitted' USING ERRCODE = '23505';
  END IF;
  IF v_session.expires_at <= v_now THEN
    RAISE EXCEPTION 'Quiz session expired' USING ERRCODE = '22023';
  END IF;

  -- Serialize attempts for an entity, including the first review row when it
  -- does not exist yet.
  PERFORM 1 FROM entities
  WHERE id = v_session.entity_id AND user_id = p_user_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz entity not found' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_review FROM reviews
  WHERE user_id = p_user_id AND entity_id = v_session.entity_id
  FOR UPDATE;

  v_ease := COALESCE(v_review.ease_factor, 2.5);
  v_interval := COALESCE(v_review.interval_days, 1);
  v_repetitions := COALESCE(v_review.repetitions, 0);

  IF p_is_correct THEN
    v_repetitions := v_repetitions + 1;
    IF v_repetitions = 1 THEN
      v_interval := 1;
    ELSIF v_repetitions = 2 THEN
      v_interval := 6;
    ELSE
      v_interval := round(v_interval * v_ease)::integer;
    END IF;
    v_ease := greatest(1.3, v_ease + 0.1);
  ELSE
    v_repetitions := 0;
    v_interval := 1;
    v_ease := greatest(1.3, v_ease - 0.2);
  END IF;

  v_next_review := v_now + make_interval(days => v_interval);

  INSERT INTO reviews (
    user_id, entity_id, question_type, last_review, next_review,
    ease_factor, interval_days, repetitions
  ) VALUES (
    p_user_id, v_session.entity_id, COALESCE(v_session.question_type, 'general'),
    v_now, v_next_review, v_ease, v_interval, v_repetitions
  )
  ON CONFLICT (user_id, entity_id) DO UPDATE SET
    question_type = EXCLUDED.question_type,
    last_review = EXCLUDED.last_review,
    next_review = EXCLUDED.next_review,
    ease_factor = EXCLUDED.ease_factor,
    interval_days = EXCLUDED.interval_days,
    repetitions = EXCLUDED.repetitions;

  UPDATE quiz_sessions SET used_at = v_now
  WHERE id = v_session.id AND user_id = p_user_id;

  RETURN QUERY SELECT p_is_correct, v_session.correct_answer, v_next_review, v_interval;
END;
$$;

REVOKE ALL ON FUNCTION grade_quiz_session(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION grade_quiz_session(uuid, uuid, boolean) TO service_role;
