-- Serialize creation/renaming of the root identity so the commit route can
-- create a missing Me node inside the graph transaction without races.
CREATE OR REPLACE FUNCTION guard_single_root_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_root_id uuid;
BEGIN
  IF NEW.user_id IS NULL OR NOT (
    COALESCE(NEW.props->>'is_user', 'false') = 'true'
    OR lower(NEW.name) = 'me'
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 22022));

  SELECT e.id INTO v_existing_root_id
  FROM entities e
  WHERE e.user_id = NEW.user_id
    AND e.deleted_at IS NULL
    AND e.id <> NEW.id
    AND (COALESCE(e.props->>'is_user', 'false') = 'true' OR lower(e.name) = 'me')
  ORDER BY (COALESCE(e.props->>'is_user', 'false') = 'true') DESC, e.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RAISE EXCEPTION 'A root identity already exists; retry with the established identity'
      USING ERRCODE = '23505', CONSTRAINT = 'entities_single_root_identity';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entities_single_root_identity_guard ON entities;
CREATE TRIGGER entities_single_root_identity_guard
  BEFORE INSERT OR UPDATE OF user_id, name, props ON entities
  FOR EACH ROW EXECUTE FUNCTION guard_single_root_identity();
