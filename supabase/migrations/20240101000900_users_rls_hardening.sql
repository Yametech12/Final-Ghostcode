-- =====================================================================
-- users RLS hardening — close the column-level privilege-escalation path
--
-- Idempotent (DROP ... IF EXISTS + CREATE). Forward-only: supersedes the
-- users policies created in 20240101000000 / 20240101000100 / 20240101000400
-- WITHOUT editing those already-applied files.
--
-- ⚠ Numbering note: the security brief asked for 20240101000800, but
--   20240101000800_advisor_reactions.sql already exists in this repo.
--   A colliding timestamp would make `supabase db push` ordering
--   ambiguous, so this migration takes the next free slot. The higher
--   timestamp is also what we want: it guarantees this runs AFTER
--   20240101000300 (adds subscription_expires_at) and after
--   20240101000400 (installs the lock trigger it extends).
--
-- Holes closed
--  1. "Users can read/write their own data" was `FOR ALL USING (id =
--     auth.uid())` — no WITH CHECK, no column restriction. A missing
--     WITH CHECK makes the USING expression double as the post-update
--     check, but it only pins *ownership*: every other column on the
--     caller's own row stayed client-writable.
--  2. The lock trigger from 20240101000400 pins `role` and
--     `subscription_tier` but NOT `subscription_expires_at` (added
--     later, in 20240101000300). Entitlement is derived from that
--     timestamp at read time — `public.has_paid_subscription()` (0300)
--     and `api/lib/tierGate.ts` — so a user whose paid period lapsed
--     could push their own expiry into the future and keep paid
--     features without ever touching subscription_tier.
--  3. A column-level REVOKE alone is a NO-OP on Supabase: the platform
--     grants *table*-level UPDATE to `authenticated`, and Postgres
--     privileges are additive. Revoking UPDATE(col) removes a grant
--     nobody depended on while the table-level grant still authorises
--     every column. The real fix is to REVOKE the table-level UPDATE and
--     then GRANT back only the columns the client legitimately writes.
--
-- ⚠ Why the WITH CHECK does NOT contain the literal subquery
--   `role = (SELECT role FROM public.users WHERE id = auth.uid())`:
--   a policy whose qualifier selects from the very table it guards makes
--   Postgres raise 42P17 "infinite recursion detected in policy for
--   relation \"users\"" — the subquery is itself subject to the users
--   policies. This repo already solved that problem for admins with the
--   SECURITY DEFINER helper `public.is_admin()`; the helpers below follow
--   the identical pattern, which is what makes the WITH CHECK usable.
-- =====================================================================

-- ──────────────────────────────────────────────────────────────────────
-- 1. Recursion-safe readers for the caller's own privileged columns
-- ──────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER so the read bypasses RLS (no policy recursion).
-- STABLE because the value is fixed for the duration of a statement.
-- search_path pinned so an earlier schema in the path can't shadow `users`.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_subscription_tier()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT subscription_tier FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_subscription_expires_at()
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT subscription_expires_at FROM public.users WHERE id = auth.uid();
$$;

-- Same grant shape the repo already uses for is_admin()
-- (20240101000100_rls_audit.sql:11).
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_subscription_tier() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_subscription_tier() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_subscription_expires_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_subscription_expires_at() TO authenticated;

COMMENT ON FUNCTION public.current_user_role() IS
  'SECURITY DEFINER: reads the caller''s own users.role without triggering a users RLS policy recursion. Used by the users UPDATE WITH CHECK.';

-- ──────────────────────────────────────────────────────────────────────
-- 2. Retire the loose FOR ALL policy
-- ──────────────────────────────────────────────────────────────────────
-- This single policy was the whole access-control surface for users: it
-- supplied SELECT, INSERT, UPDATE *and* DELETE with no WITH CHECK. Removing
-- it also removes client-side self-DELETE from the public schema — account
-- deletion is a server-side, service-role operation
-- (handleDeleteMyAccount / handleAdminDeleteUser in api/lib/handlers.ts),
-- and "Admins can delete any user" still covers the admin path.
DROP POLICY IF EXISTS "Users can read/write their own data" ON public.users;

-- ──────────────────────────────────────────────────────────────────────
-- 3. Granular, explicitly-scoped policies (idempotent restatement)
-- ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- INSERT stays: signup upserts its own public.users row from the client
-- (src/contexts/EnhancedAuthContext.tsx:144 and :214). WITH CHECK pins the
-- row to the caller's own id so nobody can pre-create a row for someone else.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: ownership AND privileged columns pinned to their stored values.
-- The helpers read the pre-update snapshot (a policy subquery sees OLD),
-- so this compares NEW against OLD exactly like the trigger does — but it
-- does so *inside* RLS, so the restriction holds even if the trigger is
-- ever dropped, renamed, or regressed by a future migration.
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role IS NOT DISTINCT FROM public.current_user_role()
    AND subscription_tier IS NOT DISTINCT FROM public.current_user_subscription_tier()
    AND subscription_expires_at IS NOT DISTINCT FROM public.current_user_subscription_expires_at()
  );

-- NOTE: "Admins can view all users" / "Admins can update any user" /
-- "Admins can delete any user" (20240101000100_rls_audit.sql:158-170) are
-- left in place untouched. Permissive policies OR together, so an admin
-- still satisfies "Admins can update any user" (which carries no WITH CHECK,
-- hence its USING doubles as the post-check) and the trigger's admin branch.

-- ──────────────────────────────────────────────────────────────────────
-- 4. Column-level privileges — the layer that actually pins the columns
-- ──────────────────────────────────────────────────────────────────────
-- Without this, the WITH CHECK above is the only thing standing between a
-- lapsed subscriber and a self-written expiry date. With it, a hostile
-- UPDATE that names an unpinned column is rejected by the privilege system
-- before RLS is even consulted.
--
-- Step 1: drop the platform's table-level UPDATE (this is the part the
-- brief's version omits — revoking the column alone changes nothing).
REVOKE UPDATE ON public.users FROM authenticated, anon;

-- Step 2: grant back exactly the columns the client writes.
--   email         — EnhancedAuthContext.tsx:214 upserts {id, email}
--   display_name  — :508 / :532 (profile form)
--   photo_url     — :509 / :533 (upload handler)
--   bio           — :534 (profile form)
--   contact_info  — :535 (profile form)
--   last_login_at — :536 (session bookkeeping)
-- Deliberately NOT granted: role, subscription_tier,
-- subscription_expires_at, id, created_at.
GRANT UPDATE (
  email,
  display_name,
  photo_url,
  bio,
  contact_info,
  last_login_at
) ON public.users TO authenticated;

-- anon has no business writing to users at all (signup goes through
-- Supabase Auth, not a direct insert).
REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon;

-- ──────────────────────────────────────────────────────────────────────
-- 5. Trigger addendum — pin subscription_expires_at as well
-- ──────────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE, not an edit to 20240101000400: that file is already
-- applied in every environment, and `supabase db push` will not re-run it.
-- Replacing the function body here takes effect immediately because
-- trg_lock_privileged_user_columns binds the function by name.
--
-- Everything from 0400 is preserved verbatim (the JWT-claims read, the
-- service_role / postgres / supabase_admin escape hatches, the is_admin()
-- branch); the only change is the third pin plus an updated comment.
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
  -- Callers allowed to mutate privileged columns:
  --   1. The service_role connection (server-side: Stripe webhook, admin
  --      operations) — recognised via JWT claims or the Postgres role.
  --   2. A real authenticated user whose users.role = 'admin'.
  --   3. Nothing else.
  -- BYPASSRLS skips POLICIES — it does not skip triggers, which is why this
  -- trigger has to test for the privileged callers itself.
  BEGIN
    caller_role := coalesce(
      current_setting('request.jwt.claims', true)::jsonb ->> 'role',
      ''
    );
  EXCEPTION WHEN OTHERS THEN
    -- Malformed claims — treat as no JWT, fall through to Postgres-role check.
    caller_role := '';
  END;

  -- ⚠ `current_user` is deliberately NOT consulted here — and it WAS in
  --   20240101000400, which is why that version of this trigger never actually
  --   blocked anything. Inside a SECURITY DEFINER function `current_user` is the
  --   FUNCTION OWNER (postgres), never the caller. Verified with a probe against
  --   this exact schema: with the caller running as `authenticated`
  --   (session_user = authenticator), current_user inside the definer still
  --   reported `postgres`. The old `OR current_user IN ('postgres','supabase_admin')`
  --   clause therefore matched on EVERY invocation and returned NEW immediately,
  --   turning the escalation lock into a no-op for all callers.
  --
  -- `session_user` is the role the session actually authenticated as and is
  -- unaffected by SECURITY DEFINER: 'authenticator' for PostgREST traffic (i.e.
  -- every end-user request, including a hostile one), 'service_role' / 'postgres'
  -- for a direct privileged connection. It is the only role check here that
  -- discriminates correctly from inside a definer.
  IF caller_role = 'service_role'
     OR session_user = 'service_role'
     -- pg_cron jobs and Supabase admin maintenance connect directly as
     -- `postgres` / `supabase_admin`; treat them as privileged so a future
     -- expire-at-end-of-period sweep isn't silently blocked.
     OR session_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  caller_is_admin := public.is_admin();
  IF caller_is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-privileged caller: pin every privileged column to its stored value.
  -- ADDED vs 20240101000400: subscription_expires_at. It is the column
  -- public.has_paid_subscription() and api/lib/tierGate.ts actually decide
  -- entitlement from, so leaving it writable made the other two pins
  -- cosmetic — a user could simply extend their own expiry.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Modifying users.role is not permitted'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'Modifying users.subscription_tier is not permitted'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at THEN
    RAISE EXCEPTION 'Modifying users.subscription_expires_at is not permitted'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Re-create the trigger so the migration is self-contained (and so a
-- deleted trigger is restored). Harmless when it already exists.
DROP TRIGGER IF EXISTS trg_lock_privileged_user_columns ON public.users;
CREATE TRIGGER trg_lock_privileged_user_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_privileged_user_columns();

COMMENT ON FUNCTION public.lock_privileged_user_columns() IS
  'Prevents non-admin authenticated users from escalating role, subscription_tier or subscription_expires_at. Service role and admins bypass. Extended by 20240101000900 to pin subscription_expires_at.';

-- ──────────────────────────────────────────────────────────────────────
-- 6. Post-flight verification — fail the migration rather than ship an
--    open row. Everything here is a hard assertion: if a future edit
--    re-introduces the FOR ALL policy or the column escape hatch, the
--    deploy stops instead of silently regressing.
-- ──────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  loose_policies integer;
  writable integer;
BEGIN
  -- No users policy may be FOR ALL (cmd = '*') any more.
  SELECT COUNT(*) INTO loose_policies
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'users'
     AND cmd = 'ALL';

  IF loose_policies > 0 THEN
    RAISE EXCEPTION
      'users still has % FOR ALL policy/policies after hardening — refusing to continue',
      loose_policies;
  END IF;

  -- The three privileged columns must not be writable by `authenticated`.
  SELECT COUNT(*) INTO writable
    FROM information_schema.column_privileges
   WHERE table_schema = 'public'
     AND table_name = 'users'
     AND grantee = 'authenticated'
     AND privilege_type = 'UPDATE'
     AND column_name IN ('role', 'subscription_tier', 'subscription_expires_at');

  IF writable > 0 THEN
    RAISE EXCEPTION
      'authenticated still holds UPDATE on % privileged users column(s) — column grants not applied',
      writable;
  END IF;

  RAISE NOTICE 'users RLS hardening verified: no FOR ALL policy, privileged columns not writable by authenticated.';
END $$;
