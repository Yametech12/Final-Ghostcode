-- =====================================================================
-- Promote juhairibrahim13@gmail.com to admin
--
-- Idempotent one-off data migration. Run in the Supabase SQL Editor
-- (runs as `postgres`, which the trg_lock_privileged_user_columns
-- trigger explicitly allows to change users.role — regular users and
-- even the app's service-role paths stay locked out of role changes by
-- design, so this cannot be done through the API).
--
-- Safe to re-run: second run is a no-op (NOTICE only).
-- =====================================================================

DO $$
DECLARE
  v_email   text := 'juhairibrahim13@gmail.com';
  v_auth_id uuid;
  promoted  integer;
  admins    integer;
BEGIN
  -- 1. Resolve the Supabase auth account. Case-insensitive match so a
  --    differently-cased signup still resolves.
  SELECT id INTO v_auth_id
    FROM auth.users
   WHERE lower(email) = lower(v_email)
   LIMIT 1;

  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION
      'No auth.users row found for % - register the account first (or fix the spelling), then re-run this migration',
      v_email;
  END IF;

  -- 2. Provision the public.users profile row if the app hasn't created
  --    it yet (mirrors the upsert in EnhancedAuthContext loadSession).
  --    ON CONFLICT (id) covers the normal case where the row exists.
  INSERT INTO public.users (id, email, role)
  VALUES (v_auth_id, v_email, 'admin')
  ON CONFLICT (id) DO NOTHING;

  -- 3. Promote. Role is a TEXT column constrained to 'user' | 'admin'
  --    (CHECK on the table), so no validation needed here.
  UPDATE public.users
     SET role = 'admin'
   WHERE id = v_auth_id
     AND role IS DISTINCT FROM 'admin';

  GET DIAGNOSTICS promoted = ROW_COUNT;

  -- 4. Verify: exactly one active admin row must match this account.
  SELECT count(*) INTO admins
    FROM public.users
   WHERE id = v_auth_id
     AND role = 'admin';

  IF admins <> 1 THEN
    RAISE EXCEPTION
      'Admin promotion verification failed for % (matched % rows) - inspect public.users manually',
      v_email, admins;
  END IF;

  SELECT count(*) INTO admins FROM public.users WHERE role = 'admin';

  RAISE NOTICE 'Admin promotion % for % (auth uid %). Total admins in public.users: %',
    CASE WHEN promoted > 0 THEN 'applied' ELSE 'already in place (no-op)' END,
    v_email, v_auth_id, admins;
END $$;
