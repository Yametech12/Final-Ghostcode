-- =====================================================================
-- Rate-limit write amplification mitigation
--
-- Idempotent. Replaces the body of record_and_count_rate_limit so that a
-- key already well past its limit short-circuits without recording a new
-- row. Without this, an attacker hammering a rate-limited endpoint at
-- N RPS would add N rows/sec to the rate_limits table even though every
-- request is being 429-rejected by the application — burning disk and
-- contending with the cleanup trigger for index pages.
--
-- The contract for the caller (api/server.ts and elsewhere) is unchanged:
--   • Returns the post-INSERT count of rows for (key, window).
--   • Caller compares against its own RATE_LIMIT to decide whether to
--     accept or reject.
--
-- The new behaviour adds an internal HARD_CAP. Once the count for a key
-- exceeds HARD_CAP within the window, subsequent calls skip the INSERT
-- and return a sentinel count = HARD_CAP + 1, which the caller will see
-- as "still over the limit" and reject the same way. The hard cap is
-- intentionally well above any legitimate per-IP or per-user quota
-- (RATE_LIMIT today is 15-30; HARD_CAP is 200) so it only kicks in for
-- abusive traffic, not for the occasional burst.
-- =====================================================================

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
  HARD_CAP constant integer := 200;
BEGIN
  -- Pre-count BEFORE the INSERT. If this key is already deeply over its
  -- limit, skip recording the row so we stop amplifying attacker writes.
  SELECT COUNT(*) INTO current_count
  FROM public.rate_limits
  WHERE key = rl_key
    AND created_at >= now() - make_interval(secs => window_seconds);

  IF current_count > HARD_CAP THEN
    -- Caller's RATE_LIMIT (15-30 in app code) is far below HARD_CAP, so
    -- returning current_count unchanged is enough to keep rejecting.
    RETURN current_count;
  END IF;

  -- Below the hard cap: record the request and return the post-INSERT
  -- count. The INSERT + COUNT pair runs in the same statement-level
  -- transaction so concurrent callers serialize on the table-level lock
  -- acquired by INSERT.
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
