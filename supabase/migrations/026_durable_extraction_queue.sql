-- Create durable extraction queue for reliable background processing

CREATE TABLE IF NOT EXISTS extraction_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempt int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  claimed_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entry_id)
);

-- Index for finding next job to process quickly
CREATE INDEX IF NOT EXISTS idx_extraction_queue_status_created_at ON extraction_queue(status, created_at);

-- RLS policies
ALTER TABLE extraction_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own extraction queue"
  ON extraction_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into their own extraction queue"
  ON extraction_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own extraction queue"
  ON extraction_queue FOR UPDATE
  USING (auth.uid() = user_id);

-- Claim oldest pending job (or stale processing job)
CREATE OR REPLACE FUNCTION claim_extraction_job(p_worker_id text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  -- Find and lock the oldest pending/stale job
  SELECT id INTO v_job_id
  FROM extraction_queue
  WHERE status = 'pending' 
     OR (status = 'processing' AND claimed_at < now() - interval '5 minutes')
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job_id IS NOT NULL THEN
    UPDATE extraction_queue
    SET status = 'processing',
        attempt = attempt + 1,
        claimed_at = now(),
        updated_at = now()
    WHERE id = v_job_id;
  END IF;

  RETURN v_job_id;
END;
$$;

-- Complete extraction job
CREATE OR REPLACE FUNCTION complete_extraction_job(
  p_entry_id uuid,
  p_status text,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE extraction_queue
  SET status = p_status,
      error_message = p_error,
      completed_at = now(),
      updated_at = now()
  WHERE entry_id = p_entry_id;
END;
$$;
