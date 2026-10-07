-- Record commit claims so a crashed request can be reclaimed after a lease.
ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS commit_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS commit_attempt integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commit_prior_status text;

CREATE INDEX IF NOT EXISTS entries_stale_commit_idx
  ON entries (commit_started_at)
  WHERE status = 'committing';
