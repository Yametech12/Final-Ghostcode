-- ============================================================================
-- 20240101000900_security_patch_pack.sql
--
-- Applies the SQL portions of the security patch pack:
--   SEC-03 — drop world-readable legacy policies that later migrations
--            never re-tightened
--   SEC-04 — pin search_path on SECURITY DEFINER functions and revoke
--            PUBLIC execution where only authenticated callers are legit
--   SEC-05 — bind advisor_messages INSERT/UPDATE to session ownership and
--            remove the leftover FOR ALL policy that OR-bypassed the
--            split policies from the RLS audit
--   SEC-06 — recreate the reaction policy idempotently
--   SEC-14 — per-user daily AI token ledger (rpc consume_ai_tokens)
--
-- Run order: after 20240101000800_advisor_reactions.sql.
-- Every statement is idempotent so re-running is safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SEC-03: world-readable legacy policies
--
-- The RLS audit (20240101000100) tightened field_reports / comments /
-- feedback reads to `authenticated`, but three CREATE-only policies in the
-- initial schema were never re-issued there and keep granting SELECT to
-- `public` (anon included):
--   • "Anyone can read feedback"        — feedback rows readable by anyone
--   • "Anyone can read likes"           — like rows readable by anyone
--   • "Anyone can read public config"   — superseded by the audit's
--                                         "Public can read public config"
--                                         (TO authenticated) replacement
--
-- These DROPs are the fix; nothing recreates them afterwards.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read feedback" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can read likes" ON public.report_likes;
DROP POLICY IF EXISTS "Anyone can read public config" ON public.public_config;

-- ----------------------------------------------------------------------------
-- SEC-04: SECURITY DEFINER hygiene
--   • SET search_path = '' → schema-qualified names inside the body can't
--     be hijacked by a malicious search_path (CWE-114 / PG-qualified advice)
--   • REVOKE from PUBLIC: is_admin() should only be callable by
--     authenticated users (used by RLS policies), not by anon.
--     has_paid_subscription() is only consumed by RLS/policies; revoking
--     PUBLIC does not affect policy evaluation because policies run as the
--     table owner with elevated rights... **correction**: policy expressions
--     run as the invoking role, so revoke PUBLIC but GRANT to authenticated
--     to keep legitimate callers working.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.users WHERE id = auth.uid()),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_paid_subscription()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT
        subscription_tier IN ('strategist', 'oracle')
        AND (
          subscription_expires_at IS NULL
          OR subscription_expires_at > NOW()
        )
      FROM public.users
      WHERE id = auth.uid()
    ),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_paid_subscription() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_paid_subscription() TO authenticated;

-- ----------------------------------------------------------------------------
-- SEC-05: advisor_messages writes must be bound to session ownership
--
-- Two problems in the accumulated policy set:
--   1. The initial schema's "Users can manage their own messages" FOR ALL
--      policy was never dropped by the RLS audit (which only DROPped
--      differently-named policies and re-created split ones). Postgres
--      permissive policies are OR-combined, so its mere existence lets any
--      user insert a message into someone else's session. Drop it.
--   2. The audit's INSERT policy checks only auth.uid() = user_id; a client
--      can pass any session_id. Recreate INSERT/UPDATE with an EXISTS
--      subquery on session ownership.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage their own messages" ON public.advisor_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.advisor_messages;
DROP POLICY IF EXISTS advisor_messages_update_reaction ON public.advisor_messages;
-- The audit migration (00100) already created these two in a fresh sequential
-- run — drop before recreate so this migration stays idempotent.
DROP POLICY IF EXISTS "Users can view own messages" ON public.advisor_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.advisor_messages;

-- Read/delete stay as the audit left them (owner-scoped, no session join
-- needed — reading your own rows is harmless).
CREATE POLICY "Users can view own messages" ON public.advisor_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages" ON public.advisor_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- SEC-05: writes bound to a session the user owns.
CREATE POLICY "Users can insert messages in own sessions" ON public.advisor_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.advisor_sessions s
      WHERE s.id = session_id
        AND s.user_id = auth.uid()
    )
  );

-- SEC-05 + SEC-06: single idempotent UPDATE policy covering the reaction
-- flow (and any future column edits) — owner AND session-owned.
CREATE POLICY advisor_messages_update_reaction ON public.advisor_messages
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.advisor_sessions s
      WHERE s.id = session_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.advisor_sessions s
      WHERE s.id = session_id
        AND s.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- SEC-14: per-user daily AI token ledger
--
-- Table tracks tokens consumed per user per UTC day. The API calls
-- consume_ai_tokens(user_id, model, est_tokens, daily_cap) BEFORE running a
-- completion; it returns the new running total and refuses (found=false)
-- when the cap is exhausted, so the handler can 429 before spending money.
--
-- SECURITY DEFINER so RLS on the table can't be bypassed by clever clients;
-- the table itself has RLS enabled with NO policies (owner-only via the
-- function, effectively zero direct client access).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_token_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')::date,
  tokens_used bigint NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.ai_token_usage ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the SECURITY DEFINER function below
-- (invoked by the API with the service role / definer rights) touches it.

CREATE OR REPLACE FUNCTION public.consume_ai_tokens(
  p_user_id uuid,
  p_model text,
  p_estimated_tokens integer,
  p_daily_cap integer
)
RETURNS TABLE (tokens_used bigint, allowed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_day date := (NOW() AT TIME ZONE 'utc')::date;
  v_current bigint;
  v_after bigint;
BEGIN
  INSERT INTO public.ai_token_usage (user_id, day, tokens_used)
  VALUES (p_user_id, v_day, 0)
  ON CONFLICT (user_id, day) DO NOTHING;

  SELECT t.tokens_used INTO v_current
  FROM public.ai_token_usage t
  WHERE t.user_id = p_user_id AND t.day = v_day
  FOR UPDATE;

  IF v_current + p_estimated_tokens > p_daily_cap THEN
    RETURN QUERY SELECT v_current, false;
    RETURN;
  END IF;

  v_after := v_current + p_estimated_tokens;

  UPDATE public.ai_token_usage t
  SET tokens_used = v_after, updated_at = NOW()
  WHERE t.user_id = p_user_id AND t.day = v_day;

  RETURN QUERY SELECT v_after, true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_ai_tokens(uuid, text, integer, integer) FROM PUBLIC;
-- Only the API's service-role connection calls this.
GRANT EXECUTE ON FUNCTION public.consume_ai_tokens(uuid, text, integer, integer) TO service_role;
