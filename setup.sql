-- Create storage bucket for user uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-uploads',
  'user-uploads',
  true,
  5242880, -- 5MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to upload their own files
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Users can upload their own files',
  'user-uploads',
  'bucket_id = ''user-uploads'' AND auth.role() = ''authenticated'' AND (storage.foldername(name))[1] = auth.uid()::text'
) ON CONFLICT (name) DO NOTHING;

-- Allow users to view their own files
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Users can view their own files',
  'user-uploads',
  'bucket_id = ''user-uploads'' AND auth.role() = ''authenticated'' AND (storage.foldername(name))[1] = auth.uid()::text'
) ON CONFLICT (name) DO NOTHING;

-- Allow public access to view all files (since bucket is public)
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Public can view files',
  'user-uploads',
  'bucket_id = ''user-uploads'''
) ON CONFLICT (name) DO NOTHING;

-- Allow users to delete their own files
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Users can delete their own files',
  'user-uploads',
  'bucket_id = ''user-uploads'' AND auth.role() = ''authenticated'' AND (storage.foldername(name))[1] = auth.uid()::text'
) ON CONFLICT (name) DO NOTHING;