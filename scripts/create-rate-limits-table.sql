-- Rate limiting table for Vercel serverless (persists across cold starts)
-- Run this in your Supabase SQL Editor to enable production rate limiting.

CREATE TABLE IF NOT EXISTS rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by key + time window
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_created 
  ON rate_limits (key, created_at DESC);

-- Auto-cleanup: delete old entries on every INSERT using a trigger.
-- This keeps the table small without needing pg_cron.
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits() RETURNS trigger AS $$
BEGIN
  DELETE FROM rate_limits WHERE created_at < now() - interval '5 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_rate_limits ON rate_limits;
CREATE TRIGGER trigger_cleanup_rate_limits
  AFTER INSERT ON rate_limits
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_rate_limits();

-- RLS: Only the service role key can access this table
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies = only service_role can read/write (which is what the API server uses)
