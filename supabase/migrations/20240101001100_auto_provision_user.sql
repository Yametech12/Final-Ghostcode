-- =====================================================================
-- 20240101001100 — Auto-provision public.users + pin is_admin search_path
--
-- Two fixes, one migration (they share the users table concern):
--
-- 1. users.id provisioning race (P1)
--    public.users previously had DEFAULT gen_random_uuid() on its PK and
--    NO trigger creating rows on signup. Four client/server code paths
--    raced to create the row on first login (loadUserData, signUp,
--    loadSession's email-sync, handleCreateOracleAnalysis's defensive
--    upsert), two used plain .insert(), and concurrent sign-ins threw
--    "Failed to create user record" / duplicate-key errors.
--
--    This migration makes the DATABASE the single provisioning writer:
--      • Drop the random-UUID default — ids must now always come from
--        auth.users (the 20240101000700 FK to auth.users(id) already
--        forbids arbitrary ids on insert; removing the default closes
--        the last "random id" path).
--      • AFTER INSERT ON auth.users → handle_new_user() inserts the
--        public.users row in the SAME transaction as the auth signup,
--        ON CONFLICT (id) DO NOTHING so re-provisioning is a no-op.
--
--    Client code (EnhancedAuthContext) was updated in the same change to
--    stop inserting user rows and read-only instead.
--
-- 2. is_admin() search_path pin (P4)
--    is_admin() is SECURITY DEFINER without SET search_path; every other
--    definer function in this repo pins it. Unpinned search_path on a
--    definer function lets a malicious schema-qualified object (e.g. a
--    rogue `users` function/table earlier on the path) shadow the real
--    public.users reference. Pin it to public — matching the other
--    definer functions.
--
-- Idempotent: safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Part 1a: drop the random-UUID default on public.users.id
-- ---------------------------------------------------------------------
ALTER TABLE public.users
  ALTER COLUMN id DROP DEFAULT;

-- ---------------------------------------------------------------------
-- Part 1b: provisioning trigger on auth.users
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Recreate (not CREATE IF NOT EXISTS) so re-runs pick up function edits.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- Part 2: pin search_path on is_admin() (P4)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.users WHERE id = auth.uid()),
    false
  );
$$;
