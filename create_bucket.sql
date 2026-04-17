-- Create storage bucket for user uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-uploads',
  'user-uploads',
  true,
  5242880, -- 5MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Note: RLS is enabled by default on storage.objects in Supabase.
-- Storage policies must be created via Dashboard or CLI (see comments below).

-- To create policies manually:
-- 1. Dashboard: Storage > Buckets > user-uploads > Policies > Add Policy
-- 2. CLI: supabase storage policies create user-uploads --name "Policy Name" --definition "condition"
--
-- Policies needed:
-- - Name: "Users can upload their own files"
--   Definition: bucket_id = 'user-uploads' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text
--   Operations: INSERT
--
-- - Name: "Users can view their own files"
--   Definition: bucket_id = 'user-uploads' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text
--   Operations: SELECT
--
-- - Name: "Public can view files"
--   Definition: bucket_id = 'user-uploads'
--   Operations: SELECT
--
-- - Name: "Users can delete their own files"
--   Definition: bucket_id = 'user-uploads' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text
--   Operations: DELETE