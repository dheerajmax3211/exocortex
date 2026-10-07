-- Track async extraction retries and let a later request reclaim a crashed run.
ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS extraction_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_attempt integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extraction_error text;

CREATE INDEX IF NOT EXISTS entries_stale_extraction_idx
  ON entries (extraction_started_at)
  WHERE status = 'extracting';
