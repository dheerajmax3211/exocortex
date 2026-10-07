-- Merge two entities in one transaction while preserving source records and
-- avoiding duplicate entry/review links.
CREATE OR REPLACE FUNCTION merge_entities(p_target_id uuid, p_source_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_user uuid;
  v_source_user uuid;
  v_target_type text;
  v_source_type text;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_target_id IS NULL OR p_source_id IS NULL OR p_target_id = p_source_id THEN
    RAISE EXCEPTION 'Two distinct entity IDs are required' USING ERRCODE = '22023';
  END IF;

  -- Lock in deterministic ID order so concurrent merges do not deadlock.
  PERFORM 1 FROM entities
  WHERE id IN (p_target_id, p_source_id)
  ORDER BY id
  FOR UPDATE;

  SELECT user_id, type INTO v_target_user, v_target_type FROM entities
  WHERE id = p_target_id AND deleted_at IS NULL;
  SELECT user_id, type INTO v_source_user, v_source_type FROM entities
  WHERE id = p_source_id AND deleted_at IS NULL;

  IF v_target_user IS NULL OR v_source_user IS NULL THEN
    RAISE EXCEPTION 'Both entities must exist and be active' USING ERRCODE = 'P0002';
  END IF;
  IF v_target_user <> v_source_user THEN
    RAISE EXCEPTION 'Entities must belong to the same user' USING ERRCODE = '42501';
  END IF;
  IF v_target_type <> v_source_type THEN
    RAISE EXCEPTION 'Entities must have the same type' USING ERRCODE = '22023';
  END IF;
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR v_target_user <> auth.uid()) THEN
    RAISE EXCEPTION 'Entities do not belong to current user' USING ERRCODE = '42501';
  END IF;

  -- Preserve entry provenance before deleting the source-side junction rows.
  INSERT INTO entry_entities(entry_id, entity_id)
  SELECT entry_id, p_target_id FROM entry_entities WHERE entity_id = p_source_id
  ON CONFLICT (entry_id, entity_id) DO NOTHING;
  DELETE FROM entry_entities WHERE entity_id = p_source_id;

  -- Keep the existing target review when both nodes have a schedule.
  INSERT INTO reviews(user_id, entity_id, question_type, last_review, next_review, ease_factor, interval_days, repetitions, created_at)
  SELECT user_id, p_target_id, question_type, last_review, next_review, ease_factor, interval_days, repetitions, created_at
  FROM reviews WHERE entity_id = p_source_id
  ON CONFLICT (user_id, entity_id) DO NOTHING;
  DELETE FROM reviews WHERE entity_id = p_source_id;

  -- Preserve all facts and state-ledger rows under the canonical target node.
  UPDATE facts SET entity_id = p_target_id WHERE user_id = v_target_user AND entity_id = p_source_id;
  UPDATE entity_state_ledger SET entity_id = p_target_id WHERE user_id = v_target_user AND entity_id = p_source_id;

  -- Preserve hierarchy context links.
  UPDATE entities SET parent_context_id = p_target_id
  WHERE user_id = v_target_user AND parent_context_id = p_source_id AND id <> p_target_id;
  UPDATE edges SET parent_context_id = p_target_id
  WHERE user_id = v_target_user AND parent_context_id = p_source_id;

  -- Do not turn a source-target relationship into a meaningless self-loop.
  UPDATE edges SET deleted_at = v_now
  WHERE user_id = v_target_user AND deleted_at IS NULL
    AND ((src = p_source_id AND dst = p_target_id) OR (src = p_target_id AND dst = p_source_id));
  UPDATE edges SET src = p_target_id WHERE user_id = v_target_user AND src = p_source_id AND dst <> p_target_id;
  UPDATE edges SET dst = p_target_id WHERE user_id = v_target_user AND dst = p_source_id AND src <> p_target_id;
  UPDATE edges SET deleted_at = v_now
  WHERE user_id = v_target_user AND deleted_at IS NULL AND src = p_target_id AND dst = p_target_id;

  -- Keep layout for the target if it already exists; otherwise carry the
  -- source position across before soft-deleting the duplicate entity.
  UPDATE graph_layout source_layout
  SET entity_id = p_target_id
  WHERE source_layout.entity_id = p_source_id
    AND source_layout.user_id = v_target_user
    AND NOT EXISTS (SELECT 1 FROM graph_layout target_layout WHERE target_layout.entity_id = p_target_id);
  DELETE FROM graph_layout WHERE entity_id = p_source_id;

  UPDATE clusters c
  SET entity_ids = ARRAY(
    SELECT DISTINCT item_id
    FROM unnest(array_replace(c.entity_ids, p_source_id, p_target_id)) AS item_ids(item_id)
    ORDER BY item_id
  )
  WHERE c.user_id = v_target_user AND p_source_id = ANY(c.entity_ids);
  UPDATE cognitive_syntheses s
  SET entity_ids = ARRAY(
    SELECT DISTINCT item_id
    FROM unnest(array_replace(s.entity_ids, p_source_id, p_target_id)) AS item_ids(item_id)
    ORDER BY item_id
  )
  WHERE s.user_id = v_target_user AND p_source_id = ANY(s.entity_ids);

  UPDATE entities target
  SET aliases = ARRAY(
        SELECT DISTINCT alias_value
        FROM unnest(COALESCE(target.aliases, '{}') || COALESCE(source.aliases, '{}') || ARRAY[source.name]) AS aliases(alias_value)
        ORDER BY alias_value
      ),
      props = COALESCE(source.props, '{}'::jsonb) || COALESCE(target.props, '{}'::jsonb),
      summary = CASE
        WHEN length(COALESCE(source.summary, '')) > length(COALESCE(target.summary, '')) THEN source.summary
        ELSE target.summary
      END
  FROM entities source
  WHERE target.id = p_target_id AND source.id = p_source_id;

  UPDATE entities SET deleted_at = v_now WHERE id = p_source_id AND user_id = v_target_user;
END;
$$;

REVOKE ALL ON FUNCTION merge_entities(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION merge_entities(uuid, uuid) TO authenticated, service_role;
