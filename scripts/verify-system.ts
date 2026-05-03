/**
 * Complete System Verification Test
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
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

async function verifyAll() {
  console.log('\n🔍 Complete System Verification\n');
  console.log('='.repeat(60));
  
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Test 1: Database Connectivity
  console.log('\n📊 Database Tests:');
  try {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (usersError) {
      log('error', `Users table: ${usersError.message}`);
    } else {
      log('success', `Users table: OK (${users?.length || 0} rows accessible)`);
    }
  } catch (err: any) {
    log('error', `Users table: ${err.message}`);
  }
  
  try {
    const { data: cal, error: calError } = await supabase
      .from('calibrations')
      .select('id')
      .limit(1);
    
    if (calError) {
      log('error', `Calibrations table: ${calError.message}`);
    } else {
      log('success', `Calibrations table: OK`);
    }
  } catch (err: any) {
    log('error', `Calibrations table: ${err.message}`);
  }
  
  try {
    const { data: reports, error: reportsError } = await supabase
      .from('field_reports')
      .select('id')
      .limit(1);
    
    if (reportsError) {
      log('error', `Field reports table: ${reportsError.message}`);
    } else {
      log('success', `Field reports table: OK (${reports?.length || 0} rows)`);
    }
  } catch (err: any) {
    log('error', `Field reports table: ${err.message}`);
  }
  
  try {
    const { data: advisorSessions, error: advisorError } = await supabase
      .from('advisor_sessions')
      .select('id')
      .limit(1);
    
    if (advisorError) {
      log('error', `Advisor sessions table: ${advisorError.message}`);
    } else {
      log('success', `Advisor sessions table: OK`);
    }
  } catch (err: any) {
    log('error', `Advisor sessions table: ${err.message}`);
  }
  
  // Test 2: Storage
  console.log('\n📁 Storage Tests:');
  try {
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      log('error', `Storage access: ${bucketError.message}`);
    } else {
      log('success', `Storage accessible: ${buckets?.length || 0} buckets found`);
      
      const userUploads = buckets?.find((b: any) => b.id === 'user-uploads');
      if (userUploads) {
        log('success', `Bucket 'user-uploads': Exists (public: ${userUploads.public})`);
      } else {
        log('error', `Bucket 'user-uploads': NOT FOUND`);
      }
    }
  } catch (err: any) {
    log('error', `Storage check failed: ${err.message}`);
  }
  
  // Test 3: Auth
  console.log('\n🔐 Auth Tests:');
  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      log('warning', `Auth check: ${authError.message}`);
    } else {
      log('success', `Auth service: OK (session: ${session ? 'active' : 'none'})`);
    }
  } catch (err: any) {
    log('error', `Auth check failed: ${err.message}`);
  }
  
  // Test 4: Service Role Permissions
  console.log('\n👤 Service Role Tests:');
  try {
    const { data: adminUsers, error: adminError } = await supabase.auth.admin.listUsers();
    
    if (adminError) {
      log('error', `Service role: ${adminError.message}`);
    } else {
      log('success', `Service role: OK (${adminUsers?.users?.length || 0} users in system)`);
    }
  } catch (err: any) {
    log('warning', `Service role test skipped (normal in client-only mode)`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Verification Complete!\n');
}

verifyAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});