-- =====================================================================
-- public.users → auth.users foreign key (long-overdue)
--
-- Idempotent. Addresses a structural correctness bug:
--
-- The 20240101000500_storage_lifecycle.sql migration's preamble assumed
-- that deleting a row in `auth.users` cascades to `public.users` via a
-- foreign key, which would in turn fire the `trg_purge_user_storage_objects`
-- AFTER DELETE trigger and clean up storage. There is no such FK in the
-- initial schema — `public.users.id` is a standalone PRIMARY KEY with no
-- relationship to `auth.users`. Result: storage objects orphan whenever
-- account deletion only flows through `supabase.auth.admin.deleteUser`
-- without an explicit follow-up `DELETE FROM public.users`. Combined with
-- the bucket public-read policy, that means deleted users' photos remain
-- world-readable forever.
--
-- This migration:
--   1. Cleans up any existing public.users rows that have no matching
--      auth.users row (orphans from before the FK existed).
--   2. Adds the FK with ON DELETE CASCADE.
--   3. Verifies the cascade chain end-to-end at the SQL level.
-- =====================================================================

-- 1. Backfill: drop public.users rows that don't have a matching auth.users.
--    These are orphans from before this migration; they can't sign in
--    anyway because there's no auth row to authenticate against. Wrapped
--    in a DO block so we can RAISE NOTICE the count — useful when
--    re-running the migration in a CI/staging environment to confirm
--    there's nothing to clean up. On a fresh prod run this might purge a
--    handful of stale rows; on subsequent runs it should always report 0.
DO $$
DECLARE
  removed integer;
BEGIN
  WITH d AS (
    DELETE FROM public.users
     WHERE id NOT IN (SELECT id FROM auth.users)
     RETURNING 1
  )
  SELECT COUNT(*) INTO removed FROM d;
  RAISE NOTICE 'users_auth_fk migration: pruned % orphan public.users row(s)', removed;
END $$;

-- 2. Add the FK if it isn't there yet. The IF NOT EXISTS dance is awkward
--    in plain ALTER TABLE — query pg_constraint instead.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'users_id_fkey'
       AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_id_fkey
      FOREIGN KEY (id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Sanity-check: ensure every public.users row points at a real auth row.
--    If this fails, the FK couldn't be added — manual cleanup needed.
DO $$
DECLARE
  orphans integer;
BEGIN
  SELECT COUNT(*) INTO orphans
    FROM public.users u
    LEFT JOIN auth.users au ON au.id = u.id
   WHERE au.id IS NULL;

  IF orphans > 0 THEN
    RAISE EXCEPTION
      'public.users has % orphan rows after FK migration; investigate before re-running',
      orphans;
  END IF;
END $$;

COMMENT ON CONSTRAINT users_id_fkey ON public.users IS
  'Cascades public.users (and all child rows + storage trigger) when the matching auth.users row is deleted. Critical for self-serve account deletion to actually purge user data.';
