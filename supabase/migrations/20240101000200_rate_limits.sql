-- =====================================================================
-- Rate-limit table + atomic limiter RPC
-- (consolidated from scripts/create-rate-limits-table.sql)
--
-- Used by api/server.ts on Vercel. The atomic insert-and-count avoids
-- the SELECT-then-INSERT race that would otherwise let bursts of
-- concurrent requests slip past the limit.
-- =====================================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_created
  ON rate_limits (key, created_at DESC);

-- Auto-cleanup keeps the table small without pg_cron.
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

-- RLS on but no policies = service_role only (which is what the API uses).
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomic insert-and-count. Returns the post-insert count for (key, window),
-- so two concurrent calls cannot both observe `count<limit` — one of them
-- will see limit+1 and be rejected by the caller.
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
  INSERT INTO public.rate_limits (key) VALUES (rl_key);

  SELECT COUNT(*) INTO current_count
  FROM public.rate_limits
  WHERE key = rl_key
    AND created_at >= now() - make_interval(secs => window_seconds);

  RETURN current_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_and_count_rate_limit(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_and_count_rate_limit(text, integer) TO service_role;
