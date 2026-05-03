/**
 * Environment validation helper
 * Call this at app startup to verify all required env vars are present
 */
export function validateEnvironment() {
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_OPENROUTER_API_KEY'
  ];

  const missing = required.filter(key => !import.meta.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. Check your .env file.`);
  }

  // Check for placeholder values
  const placeholders = [];
  if (import.meta.env.SUPABASE_SERVICE_ROLE_KEY?.includes('your_actual_service_role_key_here')) {
    placeholders.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  if (import.meta.env.VITE_RECAPTCHA_SITE_KEY?.includes('your_recaptcha_site_key_here')) {
    placeholders.push('VITE_RECAPTCHA_SITE_KEY');
  }

  if (placeholders.length > 0) {
    console.warn(`Warning: Placeholder values detected for: ${placeholders.join(', ')}. Replace with real keys.`);
  }

  return true;
}
