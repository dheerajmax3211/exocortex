-- Fixes for migrations 004-024

-- 1. Drop old overloaded signatures of record_fact_assertion
-- Since parameter lists changed across migrations 009, 014, 015, 020, 021, the old signatures
-- were left dangling. This cleans them up safely.
DROP FUNCTION IF EXISTS record_fact_assertion(uuid, text, text, uuid, timestamptz);
DROP FUNCTION IF EXISTS record_fact_assertion(uuid, text, text, uuid, timestamptz, uuid);
DROP FUNCTION IF EXISTS record_fact_assertion(uuid, text, text, uuid, timestamptz, uuid, date);

-- 2. Add missing RLS policy for quiz_sessions table
-- Table had RLS enabled in 011 but no policy. It is restricted to service_role.
ALTER TABLE IF EXISTS quiz_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quiz_sessions_service_role" ON quiz_sessions;
CREATE POLICY "quiz_sessions_service_role" ON quiz_sessions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- End of fixes
