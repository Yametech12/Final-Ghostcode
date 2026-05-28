-- =====================================================================
-- Storage lifecycle hardening
--
-- Idempotent. Addresses:
--   1. Storage objects orphaning on account deletion. The previous schema
--      cascaded DB rows on user delete but left every file in
--      storage.objects under `users/<id>/...` retrievable forever via its
--      public URL. This is a privacy/compliance gap — a deleted account
--      should not leave behind world-readable photos.
--   2. The bucket-wide public-read policy on user-uploads. The previous
--      policy permitted `SELECT` on every object regardless of name, so
--      any future non-photo upload (dossier attachments, voice notes,
--      etc.) leaked by default. This migration scopes public read to
--      profile photos specifically.
-- =====================================================================

-- ──────────────────────────────────────────────────────────────────────
-- 1. Cascade storage cleanup when a user row is deleted
-- ──────────────────────────────────────────────────────────────────────
-- Deleting auth.users CASCADES to public.users (FK), which fires this
-- AFTER DELETE trigger. We then purge every object under
-- `users/<deleted_id>/` in the user-uploads bucket. Failures are logged
-- but do not block the delete — orphan objects can be swept by a periodic
-- maintenance job if needed.
CREATE OR REPLACE FUNCTION public.purge_user_storage_objects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  removed integer;
BEGIN
  -- The Supabase storage extension exposes storage.objects directly. Match
  -- on the same path layout the API writes (`users/<uid>/...`).
  DELETE FROM storage.objects
   WHERE bucket_id = 'user-uploads'
     AND (storage.foldername(name))[1] = 'users'
     AND (storage.foldername(name))[2] = OLD.id::text;
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed > 0 THEN
    RAISE NOTICE 'purge_user_storage_objects: removed % object(s) for user %', removed, OLD.id;
  END IF;
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  -- Don't block the user delete just because a storage cleanup fails.
  RAISE WARNING 'purge_user_storage_objects: % %', SQLSTATE, SQLERRM;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_user_storage_objects ON public.users;
CREATE TRIGGER trg_purge_user_storage_objects
  AFTER DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.purge_user_storage_objects();

COMMENT ON FUNCTION public.purge_user_storage_objects() IS
  'Deletes all storage objects under users/<id>/ when the matching public.users row is deleted, so account deletion actually removes files.';

-- ──────────────────────────────────────────────────────────────────────
-- 2. Scope the public-read policy on user-uploads to profile photos only
-- ──────────────────────────────────────────────────────────────────────
-- The previous policy allowed SELECT on every object in the bucket,
-- which meant a future non-photo upload (dossier attachment, voice note,
-- private document) would be world-readable by default. Tighten it to
-- `users/<id>/profile.*` so only profile photos remain public — anything
-- else needs an explicit policy or a signed URL.
DROP POLICY IF EXISTS "Public can view profile photos" ON storage.objects;
CREATE POLICY "Public can view profile photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = 'users'
    AND (
      -- New stable name from handleUploadProfilePhoto.
      name LIKE 'users/%/profile.%'
      -- Legacy timestamped path. Kept readable so existing photoURLs in
      -- users.photo_url don't 404 until the cleanup loop in the upload
      -- handler has had a chance to migrate them.
      OR name LIKE 'users/%/profile-%'
    )
  );
