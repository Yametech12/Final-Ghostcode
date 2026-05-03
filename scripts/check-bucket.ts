/**
 * Quick Storage Bucket Check
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkBucket() {
  console.log('Checking storage buckets...\n');
  
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing buckets:', error.message);
      return;
    }
    
    console.log('Available buckets:');
    buckets.forEach((bucket: any) => {
      console.log(`  - ${bucket.id} (public: ${bucket.public}, size limit: ${bucket.file_size_limit})`);
    });
    
    const userUploads = buckets?.find((b: any) => b.id === 'user-uploads');
    if (userUploads) {
      console.log('\n✅ user-uploads bucket exists!');
    } else {
      console.log('\n❌ user-uploads bucket NOT found. Please create it in Supabase dashboard.');
    }
  } catch (err) {
    console.error('Failed:', err);
  }
}

checkBucket();