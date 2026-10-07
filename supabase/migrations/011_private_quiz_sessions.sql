-- Keep quiz answers server-side until a single answer has been submitted.
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  question_type text NOT NULL,
  question text NOT NULL,
  correct_answer text NOT NULL,
  accepted_answers text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '20 minutes'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE quiz_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE quiz_sessions TO service_role;
CREATE INDEX IF NOT EXISTS quiz_sessions_user_expiry_idx ON quiz_sessions(user_id, expires_at);

-- A user has one spaced-repetition schedule per entity. Keep the most recently
-- reviewed duplicate schedule and remove stale duplicate schedule rows before
-- enforcing the conflict target used by the API.
WITH ranked_reviews AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, entity_id
           ORDER BY last_review DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
         ) AS review_rank
  FROM reviews
)
DELETE FROM reviews r
USING ranked_reviews ranked
WHERE ranked.id = r.id AND ranked.review_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_entity_unique
  ON reviews(user_id, entity_id);
