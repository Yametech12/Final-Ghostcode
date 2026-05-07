/**
 * Environment validation helper
 * Call this at app startup to verify all required env vars are present
 */
export function validateEnvironment() {
  // Only client-side environment variables should be checked here
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
    // Note: AI API key (REGOLO_API_KEY) is server-side only
  ];

  const missing = required.filter(key => !import.meta.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. Check your .env file.`);
  }

  // Check for placeholder values (only client-exposed keys)
  const placeholders = [];
  if (import.meta.env.VITE_RECAPTCHA_SITE_KEY?.includes('your_recaptcha_site_key_here')) {
    placeholders.push('VITE_RECAPTCHA_SITE_KEY');
  }

  if (placeholders.length > 0) {
    console.warn(`Warning: Placeholder values detected for: ${placeholders.join(', ')}. Replace with real keys.`);
  }

  return true;
}
