import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_fXI5cmpdmZL3lvlbHT2i-A_LUQvpouL'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth helpers
export const auth = supabase.auth

// Database helpers
export const db = supabase

// Storage helpers
export const storage = supabase.storage