import { createClient } from '@supabase/supabase-js'

// WARNING: VITE_*_ env vars are bundled into client code at build time.
// Never reference service role keys here — only the public anon key.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

// ---------------------------------------------------------------------------
// Cross-tab session coordination
// ---------------------------------------------------------------------------
// A previous revision used a hand-rolled async mutex (`namedLock`) passed as
// the client's `lock` option to serialize refreshSession() across tabs.
// supabase-js ≥2.117 coordinates session refreshes internally without a lock
// (BroadcastChannel + storage events), the `lock` option is deprecated, and
// it is removed outright in v3 — so we rely on the library's own
// coordination now. The custom mutex was deleted with it.

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'epimetheus-auth-token',
  },
})

// Auth helpers
export const auth: typeof supabase.auth = supabase.auth as any

// Database helpers
export const db = supabase

// Storage helpers
export const storage = supabase.storage
