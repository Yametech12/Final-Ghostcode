-- =====================================================================
-- user-uploads: private bucket + owner-scoped object policies + signed URLs
--
-- Idempotent (DROP ... IF EXISTS + CREATE). Forward-only.
--
-- ⚠ Numbering note: the brief asked for 20240101000900 for this file; that
--   slot is taken by 20240101000900_users_rls_hardening.sql (see the note in
--   that file). This migration takes the next free timestamp, which also
--   guarantees it runs LAST — after 20240101000500_storage_lifecycle.sql,
--   which is the migration that (re)created the public-read photo policy.
--
-- Holes closed
--  1. storage.objects carried a bucket-wide public read policy
--     (supabase-storage-setup.sql:61 "Public can view files",
--     20240101000100_rls_audit.sql:151 and 20240101000500:70 both named
--     "Public can view profile photos"). Any anonymous caller could read
--     every object in the bucket.
--  2. The bucket itself was created with public: true
--     (api/_create-bucket.ts:21) and the legacy setup file instructs
--     operators to "Make bucket public for read access" /
--     "Grant Storage Object Viewer to allUsers" / CORS origin "*".
--     A public bucket is served by the storage API WITHOUT consulting RLS
--     at all, so tightening the policies alone would have changed nothing.
--     Both layers must move together — hence the storage.buckets UPDATE below.
--  3. The path is deterministic (`users/<userId>/profile.<ext>`,
--     api/lib/handlers.ts:174) and leaked userIds are everywhere (admin UI,
--     many tables). Combined with (1) that made every user's face photo
--     permanently world-readable — including after account deletion, because
--     the delete trigger only fires on a public.users row delete and the
--     legacy policy named no owner.
--  4. The two legacy policies from supabase-storage-setup.sql tested
--     `(storage.foldername(name))[1] = auth.uid()::text` — element [1] is
--     the literal segment 'users', not the uid, so they never matched
--     anything. Folders are `users/<uid>/...`: the uid is element [2].
-- =====================================================================

-- ──────────────────────────────────────────────────────────────────────
-- 0. RLS must be on for object policies to be enforced at all
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────
-- 1. Flip the bucket to private  ← the part that actually closes the hole
-- ──────────────────────────────────────────────────────────────────────
-- Guarded so the migration is safe in an environment where the storage
-- schema or the bucket row doesn't exist yet (fresh local `db reset`).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    UPDATE storage.buckets
       SET public = false
     WHERE id = 'user-uploads';

    IF NOT FOUND THEN
      RAISE NOTICE
        'user-uploads bucket row not found — skipping public=false flip. Create the bucket, then re-run this migration.';
    ELSE
      RAISE NOTICE 'user-uploads bucket set to private (public = false).';
    END IF;
  ELSE
    RAISE NOTICE 'storage.buckets not present — skipping bucket privacy flip.';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────
-- 2. Remove every permissive / mis-scoped object policy
-- ──────────────────────────────────────────────────────────────────────
-- Names verified against the repo before dropping. The first four are the
-- legacy dashboard-pasted set (supabase-storage-setup.sql / scripts/rls-audit.sql);
-- the next four are the migration-managed set; the last is the profile-photo
-- carve-out that let anon read `users/<id>/profile.*` by guessing the path.
DROP POLICY IF EXISTS "Public can view files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;

DROP POLICY IF EXISTS "Public can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- ──────────────────────────────────────────────────────────────────────
-- 3. Owner-scoped policies (uid is folder element [2])
-- ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
CREATE POLICY "Users can read own files" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
CREATE POLICY "Users can upload own files" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can modify own files" ON storage.objects;
CREATE POLICY "Users can modify own files" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can remove own files" ON storage.objects;
CREATE POLICY "Users can remove own files" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ──────────────────────────────────────────────────────────────────────
-- 4. Admin read/delete (admin dashboard renders other users' avatars)
-- ──────────────────────────────────────────────────────────────────────
-- public.is_admin() is SECURITY DEFINER (20240101000000), so this cannot
-- recurse. Without it the admin dashboard loses the ability to preview
-- avatars once the bucket stops serving anonymous reads.
DROP POLICY IF EXISTS "Admins can read all user files" ON storage.objects;
CREATE POLICY "Admins can read all user files" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'user-uploads' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any user file" ON storage.objects;
CREATE POLICY "Admins can delete any user file" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'user-uploads' AND public.is_admin());

-- NOTE: the storage backend writes through the service role, which bypasses
-- RLS entirely, so api/lib/handlers.ts keeps working unchanged on the write
-- path. Reads are now signed-URL based (see the handler + CORS changes).

-- ──────────────────────────────────────────────────────────────────────
-- 5. Post-flight verification — fail closed
-- ──────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  bucket_is_public boolean;
  open_select integer;
BEGIN
  -- A public bucket bypasses RLS on read, so this is the assertion that
  -- matters most: if the flip silently failed, stop the deploy.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    SELECT public INTO bucket_is_public
      FROM storage.buckets WHERE id = 'user-uploads';

    IF bucket_is_public IS TRUE THEN
      RAISE EXCEPTION
        'user-uploads bucket is still public after the privacy flip — refusing to continue';
    END IF;
  END IF;

  -- No SELECT policy on user-uploads may be satisfiable by anon: anon has no
  -- auth.uid(), so any policy whose qualifier does not reference auth.uid()
  -- is bucket-wide by definition.
  SELECT COUNT(*) INTO open_select
    FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND cmd = 'SELECT'
     AND qual IS NOT NULL
     AND qual NOT ILIKE '%auth.uid()%'
     AND qual NOT ILIKE '%is_admin()%'
     AND qual NOT ILIKE '%bucket_id%''user-uploads''%';

  IF open_select > 0 THEN
    RAISE EXCEPTION
      'storage.objects still has % bucket-wide SELECT policy/policies — refusing to continue',
      open_select;
  END IF;

  RAISE NOTICE 'storage privacy verified: user-uploads is private and no bucket-wide SELECT policy remains.';
END $$;
