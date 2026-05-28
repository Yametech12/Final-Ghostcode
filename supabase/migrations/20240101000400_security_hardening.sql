-- =====================================================================
-- Security & scaling hardening
--
-- Idempotent. Addresses:
--   1. Privilege escalation: lock users.role / users.subscription_tier so
--      a user can no longer self-promote via the client. The previous
--      "Users can update own profile" UPDATE policy had no WITH CHECK
--      preventing role/tier changes — any authenticated user could run
--      UPDATE users SET role='admin' WHERE id=auth.uid().
--   2. Missing FK indexes that RLS scans rely on.
--   3. ON DELETE CASCADE for advisor_messages.session_id so orphan rows
--      can't survive when a session is deleted via any path.
--   4. Per-user (in addition to per-IP) rate limiting bucket.
--   5. Cheaper rate-limit cleanup — replaced FOR EACH STATEMENT trigger
--      with a sampled (1%) probabilistic cleanup so the hot path doesn't
--      pay for a full DELETE scan on every insert.
--   6. Feedback insert size constraint to stop DB-fill abuse from anon.
-- =====================================================================

-- ──────────────────────────────────────────────────────────────────────
-- 1. Privilege escalation lock — block role / subscription_tier writes
--    by non-admins. Replaces the broad "Users can update own profile"
--    policy with one that has a WITH CHECK pinning sensitive columns to
--    their current value (or admin override).
--
--    A trigger is the cleanest way to enforce "can't change role unless
--    admin" because RLS WITH CHECK can only see NEW rows, not OLD. A
--    BEFORE UPDATE trigger sees both and is bypassed by SECURITY DEFINER
--    paths (server-side admin operations using service role).
-- ──────────────────────────────────────────────────────────────────────

-- subscription_tier may not exist yet (it's added in 20240101000300_subscription_tiers.sql).
-- Defensive add so this migration is order-independent if re-run partial.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE public.users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
  END IF;
END $$;

-- Trigger: prevent non-service-role, non-admin sessions from changing
-- role / subscription_tier. Service role bypasses RLS entirely so the
-- server can still mutate these (e.g. Stripe webhook upgrading a tier).
CREATE OR REPLACE FUNCTION public.lock_privileged_user_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  caller_is_admin boolean;
BEGIN
  -- We need to allow three classes of caller through:
  --   1. The Postgres service_role connection (server-side admin via the
  --      Supabase service-role key — Stripe webhook, admin UI delete, etc.).
  --   2. A real authenticated user whose users.role = 'admin'.
  --   3. Nothing else.
  --
  -- The previous implementation read `current_setting('request.jwt.claim.role', true)`
  -- which returns NULL on modern Supabase Postgres — claims are exposed under
  -- `request.jwt.claims` (plural, JSON) and there is no per-claim alias for
  -- `role`. That made every server-side update by the service role fail with
  -- "Modifying users.role is not permitted" because the trigger always fell
  -- through to the per-row check, even though service_role bypasses RLS.
  -- (BYPASSRLS skips POLICIES — it does not skip triggers.)
  --
  -- This version reads the JSON claims blob AND falls back to checking the
  -- Postgres role itself, so a direct service-role connection (no JWT) is
  -- still recognised.
  BEGIN
    caller_role := coalesce(
      current_setting('request.jwt.claims', true)::jsonb ->> 'role',
      ''
    );
  EXCEPTION WHEN OTHERS THEN
    -- Malformed claims — treat as no JWT, fall through to Postgres-role check.
    caller_role := '';
  END;

  IF caller_role = 'service_role'
     OR current_user = 'service_role'
     OR session_user = 'service_role'
     -- pg_cron jobs and Supabase admin maintenance tasks run as
     -- `postgres` or `supabase_admin`. Treat them like service role so
     -- a future expire-at-end-of-period sweep (or any backend
     -- automation that legitimately bumps subscription_tier) isn't
     -- silently blocked.
     OR current_user IN ('postgres', 'supabase_admin')
     OR session_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- is_admin() reads users.role for the current auth.uid(); it returns false
  -- when called outside a JWT-authenticated request, which is fine because
  -- we've already accepted service_role above.
  caller_is_admin := public.is_admin();
  IF caller_is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-privileged caller: pin role and subscription_tier to OLD values.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Modifying users.role is not permitted'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'Modifying users.subscription_tier is not permitted'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_privileged_user_columns ON public.users;
CREATE TRIGGER trg_lock_privileged_user_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_privileged_user_columns();

COMMENT ON FUNCTION public.lock_privileged_user_columns() IS
  'Prevents non-admin authenticated users from escalating role or subscription_tier. Service role and admins bypass.';

-- ──────────────────────────────────────────────────────────────────────
-- 2. Missing FK indexes (RLS scan acceleration)
-- ──────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_advisor_messages_user
  ON public.advisor_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_field_report_comments_report_timestamp
  ON public.field_report_comments(report_id, timestamp ASC);

CREATE INDEX IF NOT EXISTS idx_field_report_comments_user
  ON public.field_report_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_report_likes_user
  ON public.report_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_assessment_results_user_timestamp
  ON public.assessment_results(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_users_role
  ON public.users(role) WHERE role = 'admin';

-- ──────────────────────────────────────────────────────────────────────
-- 3. CASCADE delete for advisor_messages
-- ──────────────────────────────────────────────────────────────────────
-- The original FK omits ON DELETE CASCADE; if a session is deleted via
-- any path other than handleDeleteAdvisorSession (which manually deletes
-- messages first), orphan messages remain.
ALTER TABLE public.advisor_messages
  DROP CONSTRAINT IF EXISTS advisor_messages_session_id_fkey;

ALTER TABLE public.advisor_messages
  ADD CONSTRAINT advisor_messages_session_id_fkey
  FOREIGN KEY (session_id)
  REFERENCES public.advisor_sessions(id)
  ON DELETE CASCADE;

-- ──────────────────────────────────────────────────────────────────────
-- 4. Per-user rate-limit bucket — atomic insert+count keyed by user_id.
--    Used in addition to the per-IP bucket so a single authenticated
--    user behind a NAT can't burn the shared per-IP quota for everyone.
-- ──────────────────────────────────────────────────────────────────────
-- Reuses the existing rate_limits table; we simply add a different
-- key prefix from the application layer (e.g., "user:<uuid>"). No new
-- DDL required, just a comment for discoverability.
COMMENT ON TABLE public.rate_limits IS
  'Per-key rate-limit buckets. Application uses prefixes: rate:<ip> per-IP, log:<ip> for /api/security/log, user:<uuid> per-user.';

-- ──────────────────────────────────────────────────────────────────────
-- 5. Cheaper rate-limit cleanup
-- ──────────────────────────────────────────────────────────────────────
-- Replace per-statement trigger with a sampled cleanup that fires on
-- ~1% of inserts. At 1000 RPS this still cleans every ~100 ms but
-- doesn't add a full DELETE scan to the hot path.
DROP TRIGGER IF EXISTS trigger_cleanup_rate_limits ON public.rate_limits;

CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS trigger
LANGUAGE plpgsql
-- Pin search_path so a malicious schema injected earlier in the path can't
-- shadow `rate_limits` or any helper. Matches the hardening on
-- record_and_count_rate_limit elsewhere in this migration set.
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sample ~1% of inserts. Postgres random() is fine for this; we don't
  -- need cryptographic randomness, just amortization across calls.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits
    WHERE created_at < now() - interval '5 minutes';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_cleanup_rate_limits
  AFTER INSERT ON public.rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_old_rate_limits();

-- ──────────────────────────────────────────────────────────────────────
-- 6. Feedback abuse mitigation
-- ──────────────────────────────────────────────────────────────────────
-- The "Anonymous can submit feedback" RLS policy lets anon insert rows
-- with no length cap. Add column-level CHECK constraints so a script
-- can't fill the table with multi-MB rows. Existing rows that violate
-- the constraint are left alone — NOT VALID skips the table scan and
-- only enforces the constraint on new writes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_message_length_check'
  ) THEN
    ALTER TABLE public.feedback
      ADD CONSTRAINT feedback_message_length_check
      CHECK (length(message) <= 5000) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_url_length_check'
  ) THEN
    ALTER TABLE public.feedback
      ADD CONSTRAINT feedback_url_length_check
      CHECK (url IS NULL OR length(url) <= 500) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_user_agent_length_check'
  ) THEN
    ALTER TABLE public.feedback
      ADD CONSTRAINT feedback_user_agent_length_check
      CHECK (user_agent IS NULL OR length(user_agent) <= 500) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feedback_email_length_check'
  ) THEN
    ALTER TABLE public.feedback
      ADD CONSTRAINT feedback_email_length_check
      CHECK (email IS NULL OR length(email) <= 254) NOT VALID;
  END IF;
END $$;
