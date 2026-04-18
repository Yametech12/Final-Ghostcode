// 🔍 EPIMETHEUS DEBUG SCRIPT - Paste this in browser console at https://epimetheusproject.vercel.app/

console.log('🔍 EPIMETHEUS DEBUG - Starting comprehensive audit...\n');

// 1. Check Supabase Configuration
console.log('📊 SUPABASE CONFIG:');
try {
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

  console.log('✅ Supabase URL:', supabaseUrl ? 'Set' : 'MISSING');
  console.log('✅ Supabase Key:', supabaseKey ? 'Set (length: ' + supabaseKey.length + ')' : 'MISSING');

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ CRITICAL: Supabase environment variables missing!');
  }
} catch (e) {
  console.error('❌ Cannot access Supabase config:', e);
}

// 2. Check Current Session State
console.log('\n🔐 SESSION STATE:');
try {
  // Check localStorage for Supabase auth
  const keys = Object.keys(localStorage).filter(k => k.includes('supabase'));
  console.log('📦 LocalStorage Supabase keys:', keys);

  keys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      console.log(`  ${key}:`, value ? 'Set' : 'Empty');
    } catch (e) {
      console.log(`  ${key}: Error reading -`, e.message);
    }
  });

  // Check sessionStorage
  const sessionKeys = Object.keys(sessionStorage).filter(k => k.includes('supabase') || k.includes('auth'));
  console.log('📦 SessionStorage auth keys:', sessionKeys);

} catch (e) {
  console.error('❌ Cannot access storage:', e);
}

// 3. Test API Endpoints
console.log('\n🌐 API ENDPOINTS TEST:');
const endpoints = [
  '/api/health',
  '/api/ai/test-key'
];

endpoints.forEach(async (endpoint) => {
  try {
    console.log(`Testing ${endpoint}...`);
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`  ✅ ${endpoint}: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const text = await response.text();
      console.log(`    Response: ${text.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`  ❌ ${endpoint}: ${error.message}`);
  }
});

// 4. Check Network Requests (Recent)
console.log('\n📡 RECENT NETWORK REQUESTS:');
if (window.performance && window.performance.getEntriesByType) {
  const networkEntries = window.performance.getEntriesByType('navigation')
    .concat(window.performance.getEntriesByType('resource'))
    .filter(entry => entry.name.includes('supabase') || entry.name.includes('api'))
    .slice(-5); // Last 5

  networkEntries.forEach(entry => {
    console.log(`  ${entry.name}: ${Math.round(entry.duration)}ms (${entry.transferSize} bytes)`);
  });
}

// 5. Check for JavaScript Errors
console.log('\n🐛 RECENT ERRORS:');
const originalError = console.error;
let errorCount = 0;

console.error = function(...args) {
  errorCount++;
  if (errorCount <= 5) { // Show first 5 errors
    console.log('  Error:', ...args);
  }
  originalError.apply(console, args);
};

// 6. Test Supabase Connection Directly
console.log('\n🔗 SUPABASE CONNECTION TEST:');
setTimeout(async () => {
  try {
    // This will test if we can reach Supabase
    const testResponse = await fetch('https://cuinkiyozecqkskmufgo.supabase.co/rest/v1/', {
      method: 'HEAD',
      headers: {
        'apikey': import.meta.env?.VITE_SUPABASE_ANON_KEY || 'test'
      }
    });

    console.log('✅ Supabase reachable:', testResponse.status);

  } catch (error) {
    console.log('❌ Supabase unreachable:', error.message);
  }

  console.log('\n🏁 DEBUG COMPLETE - Check results above');
  console.log('💡 If you see errors, share the output with your developer');
}, 2000);