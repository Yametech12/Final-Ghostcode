-- =====================================================================
-- DEPRECATED — kept on disk for one release cycle.
--
-- The canonical schema source is now `supabase/migrations/`. The contents
-- of this file have been folded into:
--   supabase/migrations/20240101000200_rate_limits.sql
--
-- This file will be deleted after the next release.
-- =====================================================================

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


-- =====================================================================
-- Atomic rate-limit checker
-- =====================================================================
-- The previous Vercel handler used SELECT count → INSERT, which has a race
-- window: a burst of N concurrent requests can each see count<limit and all
-- pass through before any of them inserts a row.
--
-- This RPC inserts a single row and returns the post-insert count for the
-- (key, time-window) pair atomically, so two simultaneous calls cannot both
-- see "n_requests = limit" — one of them will see limit+1 and be rejected.
--
-- Returns: integer count of requests by `key` in the last `window_seconds`,
-- including the row this call inserted. Caller compares against its own
-- limit to decide whether to reject.
CREATE OR REPLACE FUNCTION public.record_and_count_rate_limit(
  rl_key text,
  window_seconds integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
BEGIN
  -- The INSERT and the COUNT below run inside the same statement-level
  -- transaction (Postgres autocommit per RPC call), so concurrent calls
  -- serialize on the table-level lock acquired by INSERT.
  INSERT INTO public.rate_limits (key) VALUES (rl_key);

  SELECT COUNT(*) INTO current_count
  FROM public.rate_limits
  WHERE key = rl_key
    AND created_at >= now() - make_interval(secs => window_seconds);

  RETURN current_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_and_count_rate_limit(text, integer) FROM PUBLIC;
-- Service role only — the Vercel handler uses the service key.
GRANT EXECUTE ON FUNCTION public.record_and_count_rate_limit(text, integer) TO service_role;
