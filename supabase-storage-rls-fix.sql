-- EPIMETHEUS Supabase Storage RLS Policies
-- Run this in Supabase SQL Editor to fix photo upload permissions

-- ============================================
-- USER-UPLOADS BUCKET POLICIES
-- ============================================

-- Step 1: Delete any existing conflicting policies
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can select their own files" ON storage.objects;

-- Step 2: Allow authenticated users to INSERT (upload) their own files
-- Path format must be: {userId}/filename
CREATE POLICY "Users can upload their own photos" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'user-uploads'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Step 3: Allow users to SELECT (view) their own files
CREATE POLICY "Users can view own files" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'user-uploads'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Step 4: Allow public read access to all files in user-uploads (for profile photos)
CREATE POLICY "Public can view all uploads" ON storage.objects
FOR SELECT
USING (bucket_id = 'user-uploads');

-- Step 5: Allow users to UPDATE (overwrite) their own files
CREATE POLICY "Users can update own files" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'user-uploads'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Step 6: Allow users to DELETE their own files
CREATE POLICY "Users can delete own files" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'user-uploads'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- VERIFICATION
-- ============================================
-- To verify, run this query:
-- SELECT * FROM storage.objects WHERE bucket_id = 'user-uploads' LIMIT 10;