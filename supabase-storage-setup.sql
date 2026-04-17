-- Supabase Storage Setup for User Uploads
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- NOTE: Run this AFTER creating the bucket in the Storage UI

-- First, verify the bucket exists (if not, create it via Storage UI)
SELECT id, name, public FROM storage.buckets WHERE id = 'user-uploads';

-- Enable RLS on storage.objects (only if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'objects' AND schemaname = 'storage') THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Create policy: Allow authenticated users to upload their own files
CREATE POLICY "Users can upload their own files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'user-uploads'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy: Allow users to view their own files
CREATE POLICY "Users can view their own files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'user-uploads'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy: Allow public access to view all files
CREATE POLICY "Public can view files" ON storage.objects
FOR SELECT USING (bucket_id = 'user-uploads');

-- Create policy: Allow users to delete their own files
CREATE POLICY "Users can delete their own files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'user-uploads'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy: Allow users to update their own files
CREATE POLICY "Users can update their own files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'user-uploads'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);