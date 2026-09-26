import "dotenv/config";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
  console.error('VITE_SUPABASE_URL not found in environment variables');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment variables. Bucket creation requires service role key.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Creates the user-uploads bucket as PRIVATE.
 *
 * `public: true` used to be set here. That was the root of the leak: a public
 * bucket is served by the storage API without consulting RLS at all, so every
 * policy in supabase/migrations/*storage*  was decorative for reads, and each
 * profile photo was world-readable forever at the deterministic path
 * `users/<userId>/profile.<ext>`.
 *
 * With `public: false`, reads go through createSignedUrl() (see
 * handleUploadProfilePhoto / handleGetMyProfilePhotoUrl in api/lib/handlers.ts),
 * which is what makes the object policies in
 * 20240101001000_storage_private_bucket.sql meaningful.
 *
 * Idempotent: createBucket() errors if the bucket already exists, so we fall
 * back to updateBucket() to flip an existing public bucket private.
 */
async function createBucket() {
  const { data, error } = await supabase.storage.createBucket('user-uploads', {
    public: false,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  });

  if (error) {
    // Already exists → force it private rather than failing the run.
    const { data: updated, error: updateError } = await supabase.storage.updateBucket('user-uploads', {
      public: false,
      fileSizeLimit: 5242880,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    });

    if (updateError) {
      console.error('Error creating bucket:', error.message);
      console.error('Error updating bucket to private:', updateError.message);
      process.exit(1);
    }
    console.log('Bucket already existed — forced to private:', updated);
    return;
  }

  console.log('Bucket created successfully (private):', data);
}

createBucket();
