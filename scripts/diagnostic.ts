/**
 * Database Connection Diagnostic Script
 * Run this to test your Supabase database and storage configuration
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function log(status: 'success' | 'error' | 'warning' | 'info', message: string) {
  const icons = {
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warning: `${colors.yellow}⚠${colors.reset}`,
    info: `${colors.yellow}ℹ${colors.reset}`
  };
  console.log(`${icons[status]} ${message}`);
}

async function runDiagnostics() {
  console.log('\n🔍 Running Supabase Diagnostics...\n');
  console.log('=' .repeat(50));

  // Check 1: Environment Variables
  console.log('\n1️⃣ Checking Environment Variables:');
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    log('error', 'VITE_SUPABASE_URL is not set');
    return;
  } else {
    log('success', `VITE_SUPABASE_URL: ${supabaseUrl.substring(0, 50)}...`);
  }

  if (!supabaseAnonKey) {
    log('error', 'VITE_SUPABASE_ANON_KEY is not set');
    return;
  } else {
    log('success', `VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey.substring(0, 20)}...`);
  }

  if (!supabaseServiceKey) {
    log('warning', 'SUPABASE_SERVICE_ROLE_KEY is not set (required for backend operations)');
  } else {
    log('success', `SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey.substring(0, 20)}...`);
  }

  // Check 2: Client Initialization
  console.log('\n2️⃣ Testing Client Connections:');
  
  try {
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    log('success', 'Anon client initialized successfully');
    
    // Check 3: Auth Status
    console.log('\n3️⃣ Testing Authentication:');
    const { data: { session }, error: authError } = await anonClient.auth.getSession();
    
    if (authError) {
      log('error', `Auth check failed: ${authError.message}`);
    } else {
      log('success', `Auth service accessible (${session ? 'session exists' : 'no session'})`);
    }

    // Check 4: Database Tables
    console.log('\n4️⃣ Testing Database Tables:');
    const tables = ['users', 'calibrations', 'field_reports', 'advisor_sessions'];
    
    for (const table of tables) {
      try {
        const { data, error } = await anonClient
          .from(table)
          .select('id')
          .limit(1);
        
        if (error) {
          if (error.code === 'PGRST205') {
            log('error', `Table '${table}' does not exist - apply supabase-schema-v2.sql`);
          } else if (error.code === 'PGRST401') {
            log('error', `Table '${table}' access denied - check RLS policies`);
          } else {
            log('error', `Table '${table}' error: ${error.message}`);
          }
        } else {
          log('success', `Table '${table}' accessible`);
        }
      } catch (err) {
        log('error', `Table '${table}' test failed: ${err}`);
      }
    }

    // Check 5: Storage Bucket
    console.log('\n5️⃣ Testing Storage Bucket:');
    try {
      const { data: buckets, error: bucketsError } = await anonClient.storage.listBuckets();
      
      if (bucketsError) {
        log('error', `Storage list failed: ${bucketsError.message}`);
      } else {
        const userUploadsBucket = buckets?.find((b: any) => b.id === 'user-uploads');
        if (userUploadsBucket) {
          log('success', 'user-uploads bucket exists');
          log('info', `Public: ${userUploadsBucket.public}, Size limit: ${userUploadsBucket.file_size_limit}`);
        } else {
          log('error', 'user-uploads bucket not found - create it in Supabase dashboard');
        }
      }
    } catch (err) {
      log('error', `Storage check failed: ${err}`);
    }

    // Check 6: Service Role (if available)
    if (supabaseServiceKey) {
      console.log('\n6️⃣ Testing Service Role:');
      try {
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
        const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers();
        
        if (usersError) {
          log('error', `Service role error: ${usersError.message}`);
        } else {
          log('success', `Service role working (${users?.length || 0} users found)`);
        }
      } catch (err) {
        log('error', `Service role test failed: ${err}`);
      }
    }

  } catch (err: any) {
    log('error', `Connection failed: ${err.message}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✨ Diagnostic Complete!\n');
}

runDiagnostics();