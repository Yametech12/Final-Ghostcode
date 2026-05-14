import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use localStorage for session persistence (default, but explicit is safer)
    persistSession: true,
    // Auto-refresh the token before it expires
    autoRefreshToken: true,
    // Detect session from URL hash on OAuth redirects
    detectSessionInUrl: true,
    // Use a single storage key to avoid lock conflicts
    storageKey: 'epimetheus-auth-token',
    // Use a custom lock implementation that doesn't time out in StrictMode
    lock: async <R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
      // Simple non-blocking lock — avoids the 5000ms timeout warning in React StrictMode
      // by not using the Web Locks API (which can orphan locks on component remount).
      void name; void acquireTimeout;
      return await fn();
    },
  },
})

// Auth helpers
export const auth: typeof supabase.auth = supabase.auth as any

// Database helpers
export const db = supabase

// Storage helpers
export const storage = supabase.storage
