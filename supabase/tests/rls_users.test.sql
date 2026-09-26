-- =====================================================================
-- RLS / privilege-escalation regression tests
--
-- Covers the holes closed by:
--   • 20240101000900_users_rls_hardening.sql    (users policies + column grants + trigger)
--   • 20240101001000_storage_private_bucket.sql (private bucket + owner-scoped policies)
--
-- Run with:    supabase test db
-- or directly: psql "$DB_URL" -f supabase/tests/rls_users.test.sql
--
-- The whole file runs in ONE transaction and ROLLBACKs, so it leaves nothing
-- behind.
--
-- IMPERSONATION MODEL. A hostile client is not a UI path — it is PostgREST
-- running a statement as `authenticated` with a valid JWT. To reproduce that
-- faithfully the probes below use the real platform role topology:
--     SET SESSION AUTHORIZATION authenticator;   -- who the session logged in as
--     SET LOCAL ROLE authenticated;              -- who the request runs as
--     SET LOCAL request.jwt.claims = '{...}';    -- the verified JWT
-- `auth.uid()` reads claims->>'sub'; the lock trigger reads claims->>'role'.
-- session_user stays 'authenticator' exactly as it does for live traffic, which
-- matters because the trigger consults session_user.
--
-- Probes run through public._rls_try(), a SECURITY INVOKER helper that captures
-- either 'SUCCEEDED' or 'SQLSTATE|message'. That keeps pgTAP's own assertions
-- running as the table owner (pgTAP's result storage is a session-owned temp
-- table and is not reliable underneath SET ROLE).
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET search_path = extensions, public, storage;

GRANT USAGE ON SCHEMA extensions TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated, anon;
GRANT USAGE ON SCHEMA public, storage TO authenticated, anon;

SELECT plan(15);

-- ---------------------------------------------------------------------
-- Fixtures (created privileged, so the BEFORE UPDATE lock lets them through)
-- ---------------------------------------------------------------------
\set victim_id   '11111111-1111-4111-8111-111111111111'
\set attacker_id '22222222-2222-4222-8222-222222222222'

INSERT INTO auth.users (id, email) VALUES
  (:'victim_id',   'victim@example.test'),
  (:'attacker_id', 'attacker@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, display_name, role, subscription_tier, subscription_expires_at)
VALUES
  -- A LAPSED subscriber: subscription_tier still reads 'strategist' but the
  -- paid period ended yesterday. Extending this timestamp would restore paid
  -- access without payment — the paywall bypass from the report.
  (:'victim_id',   'victim@example.test',   'Victim',   'user', 'strategist', now() - interval '1 day'),
  (:'attacker_id', 'attacker@example.test', 'Attacker', 'user', 'free',       NULL)
ON CONFLICT (id) DO NOTHING;

-- NOTE: the bucket's `public` flag is deliberately NOT set here. The environment
-- shim creates it as public:true (the pre-fix state api/_create-bucket.ts used
-- to produce) and assertion T12 checks that the migration flipped it to false.
INSERT INTO storage.buckets (id, name) VALUES ('user-uploads', 'user-uploads')
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.objects (bucket_id, name, owner) VALUES
  ('user-uploads', 'users/' || :'victim_id'   || '/profile.webp', :'victim_id'),
  ('user-uploads', 'users/' || :'attacker_id' || '/profile.webp', :'attacker_id')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- Probe harness
-- ---------------------------------------------------------------------
CREATE TABLE public._rls_probe (k text PRIMARY KEY, v text);
GRANT INSERT, SELECT ON public._rls_probe TO authenticated, anon;

-- SECURITY INVOKER (the default): the statement runs with the CALLER's
-- privileges, so column grants, RLS policies and triggers are all exercised
-- exactly as they would be for a real request.
CREATE OR REPLACE FUNCTION public._rls_try(stmt text) RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE stmt;
  RETURN 'SUCCEEDED';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || '|' || SQLERRM;
END;
$$;
GRANT EXECUTE ON FUNCTION public._rls_try(text) TO authenticated, anon;

-- =====================================================================
-- A. Static shape of the hardened users table (asserted as table owner)
-- =====================================================================

-- T1 — no FOR ALL policy may survive on users.
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND cmd = 'ALL'),
  0,
  'users has no FOR ALL policy (the loose "Users can read/write their own data" is gone)'
);

-- T2 — the TABLE-level UPDATE grant must be gone, read from pg_class.relacl
--      rather than has_table_privilege() so the column grants made by the same
--      migration cannot mask a surviving table grant. This is precisely what
--      the originally-supplied snippet FAILS: revoking UPDATE(role, ...) alone
--      leaves the table-level grant intact and every privileged column writable.
SELECT is(
  (SELECT count(*)::int
     FROM pg_class c,
          LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
    WHERE c.oid = 'public.users'::regclass
      AND a.grantee = 'authenticated'::regrole
      AND a.privilege_type = 'UPDATE'),
  0,
  'no table-level UPDATE grant on public.users for authenticated'
);

-- T3/T4 — exactly the non-privileged columns are writable.
SELECT is(
  has_column_privilege('authenticated', 'public.users', 'display_name', 'UPDATE'),
  true,
  'authenticated can still UPDATE display_name (profile form keeps working)'
);

SELECT is(
  has_column_privilege('authenticated', 'public.users', 'subscription_expires_at', 'UPDATE'),
  false,
  'authenticated cannot UPDATE subscription_expires_at at the privilege layer'
);

-- =====================================================================
-- B. Probes as a fully-authenticated non-admin user (privilege layer intact)
-- =====================================================================
SET SESSION AUTHORIZATION authenticator;
SET search_path = extensions, public, storage;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

INSERT INTO public._rls_probe (k, v) VALUES
  -- P1: the headline escalation.
  ('P1', public._rls_try('UPDATE public.users SET role = ''admin'' WHERE id = ''22222222-2222-4222-8222-222222222222''')),
  -- P2: the paywall bypass.
  ('P2', public._rls_try('UPDATE public.users SET subscription_expires_at = ''2099-01-01T00:00:00Z'' WHERE id = ''11111111-1111-4111-8111-111111111111''')),
  -- P3: legitimate profile edit — the product must keep working.
  ('P3', public._rls_try('UPDATE public.users SET display_name = ''Renamed'' WHERE id = ''22222222-2222-4222-8222-222222222222'''));

-- P4: the entitlement helper the exploit targets, evaluated as the victim.
RESET SESSION AUTHORIZATION; SET search_path = extensions, public, storage;
SET SESSION AUTHORIZATION authenticator;
SET search_path = extensions, public, storage;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
INSERT INTO public._rls_probe (k, v) VALUES ('P4', public.has_paid_subscription()::text);

-- =====================================================================
-- C. Probes with the privileged columns re-granted — isolates the TRIGGER
-- =====================================================================
-- Without this step the column grants would mask a broken trigger: the statement
-- would die at the privilege layer and a no-op trigger would look like it was
-- working. Re-granting makes the lock trigger and the RLS WITH CHECK the only
-- barriers. (Transaction-scoped; the final ROLLBACK discards the grant.)
RESET SESSION AUTHORIZATION; SET search_path = extensions, public, storage;
GRANT UPDATE (role, subscription_tier, subscription_expires_at)
  ON public.users TO authenticated;

SET SESSION AUTHORIZATION authenticator;
SET search_path = extensions, public, storage;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

INSERT INTO public._rls_probe (k, v) VALUES
  -- P5: role pin (pre-existing behaviour, kept as a regression guard).
  ('P5', public._rls_try('UPDATE public.users SET role = ''admin'' WHERE id = ''22222222-2222-4222-8222-222222222222''')),
  -- P6: THE FIX — a user extending THEIR OWN expiry. It must target the
  -- attacker's own row: the users UPDATE policy is USING (auth.uid() = id), so
  -- aiming at somebody else's row would touch 0 rows and silently "succeed"
  -- without ever reaching the trigger (that is RLS doing its job, not the lock).
  ('P6', public._rls_try('UPDATE public.users SET subscription_expires_at = ''2099-01-01T00:00:00Z'' WHERE id = ''22222222-2222-4222-8222-222222222222'''));

-- =====================================================================
-- D. Storage probes — anonymous vs owner vs other-user
-- =====================================================================
RESET SESSION AUTHORIZATION; SET search_path = extensions, public, storage;
SET SESSION AUTHORIZATION authenticator;
SET search_path = extensions, public, storage;
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{}';
INSERT INTO public._rls_probe (k, v) VALUES
  ('P7', (SELECT count(*)::text FROM storage.objects WHERE bucket_id = 'user-uploads'));

RESET SESSION AUTHORIZATION; SET search_path = extensions, public, storage;
SET SESSION AUTHORIZATION authenticator;
SET search_path = extensions, public, storage;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
INSERT INTO public._rls_probe (k, v) VALUES
  ('P8', (SELECT count(*)::text FROM storage.objects
           WHERE name = 'users/22222222-2222-4222-8222-222222222222/profile.webp')),
  ('P9', (SELECT count(*)::text FROM storage.objects
           WHERE name = 'users/11111111-1111-4111-8111-111111111111/profile.webp'));

-- =====================================================================
-- E. Assertions on the captured probe outcomes
-- =====================================================================
RESET SESSION AUTHORIZATION; SET search_path = extensions, public, storage;

-- T5/T6 — rejected at the privilege layer (SQLSTATE 42501).
SELECT ok((SELECT v FROM public._rls_probe WHERE k = 'P1') LIKE '42501|%',
  'authenticated user cannot self-promote to admin (privilege denied, SQLSTATE 42501)');

SELECT ok((SELECT v FROM public._rls_probe WHERE k = 'P2') LIKE '42501|%',
  'authenticated user cannot push their own subscription_expires_at into the future');

-- T7/T8 — regression guard: the allowed column still works.
SELECT is((SELECT v FROM public._rls_probe WHERE k = 'P3'), 'SUCCEEDED',
  'authenticated user CAN still update an explicitly granted column (display_name)');

SELECT is((SELECT display_name FROM public.users WHERE id = :'attacker_id'), 'Renamed',
  'the allowed column write actually landed');

-- T9 — the entitlement helper still reports "not entitled".
SELECT is((SELECT v FROM public._rls_probe WHERE k = 'P4'), 'false',
  'lapsed subscriber is still not entitled after attempting to extend their own expiry');

-- T10 — trigger pins role (regression guard for the pre-existing behaviour).
SELECT ok((SELECT v FROM public._rls_probe WHERE k = 'P5')
            LIKE '42501|Modifying users.role is not permitted%',
  'lock trigger pins users.role');

-- T11 — THE FIX: the column 20240101000400 forgot. This fails on the
--       pre-hardening baseline for two independent reasons — the column was
--       never pinned, and the trigger's `current_user IN (postgres,...)` escape
--       hatch matched on every call, making the whole lock a no-op.
SELECT ok((SELECT v FROM public._rls_probe WHERE k = 'P6')
            LIKE '42501|Modifying users.subscription_expires_at is not permitted%',
  'lock trigger pins users.subscription_expires_at too (the escalation fix)');

-- T12 — the bucket row itself must be private: a public bucket is served by the
--       storage API WITHOUT consulting RLS, so policy tightening alone is inert.
SELECT is((SELECT public FROM storage.buckets WHERE id = 'user-uploads'), false,
  'user-uploads bucket is private (public = false) — migration flipped it from true');

-- T13 — anonymous read returns zero rows.
SELECT is((SELECT v FROM public._rls_probe WHERE k = 'P7'), '0',
  'anonymous SELECT on user-uploads objects returns 0 rows (was world-readable)');

-- T14/T15 — owner can read their own object; nobody can read a guessed path.
SELECT is((SELECT v FROM public._rls_probe WHERE k = 'P8'), '1',
  'authenticated user CAN read their own object (this is what signed URLs serve)');

SELECT is((SELECT v FROM public._rls_probe WHERE k = 'P9'), '0',
  'authenticated user CANNOT read another user''s object by guessing the deterministic path');

SELECT * FROM finish();
ROLLBACK;
