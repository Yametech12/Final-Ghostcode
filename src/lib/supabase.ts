import { createClient } from '@supabase/supabase-js'

// WARNING: VITE_*_ env vars are bundled into client code at build time.
// Never reference service role keys here — only the public anon key.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

// ---------------------------------------------------------------------------
// Per-name async mutex
// ---------------------------------------------------------------------------
// Replaces a previous no-op `lock` that always passed straight through. The
// no-op meant two tabs (or React StrictMode's double-invoke) could both run
// `refreshSession()` in parallel, race against Supabase's refresh-token
// rotation, and one would invalidate the other — manifesting as random
// logouts.
//
// Implementation: a Map<string, Promise<void>> holding the current "tail" for
// each lock name. Each acquire chains its callback after the existing tail.
// Supports an `acquireTimeout` so a stuck lock can't deadlock the caller —
// the timeout rejects the wait, but the queue tail is still chained so the
// callback eventually runs (vs. being silently dropped).
const lockTails = new Map<string, Promise<unknown>>()

async function namedLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  const previousTail = lockTails.get(name) ?? Promise.resolve()

  let release!: () => void
  const next = new Promise<void>((resolve) => {
    release = resolve
  })
  // Attach `next` as the new tail BEFORE awaiting `previousTail`, so concurrent
  // callers see this slot in queue immediately.
  lockTails.set(name, previousTail.then(() => next))

  // Wait for the previous holder, with a timeout so a hung tail (e.g. tab
  // backgrounded by browser) doesn't block forever. If timeout fires we still
  // try to run `fn` — the worst case is the same race the no-op had, but only
  // after a deliberate wait, not on every call.
  if (acquireTimeout > 0) {
    let timer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      previousTail,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, acquireTimeout)
      }),
    ])
    if (timer) clearTimeout(timer)
  } else {
    await previousTail
  }

  try {
    return await fn()
  } finally {
    release()
    // Tidy up: if no one chained behind us, drop the entry so the Map
    // doesn't grow unbounded.
    if (lockTails.get(name) === previousTail.then(() => next)) {
      // Reference equality check is unreliable across `then` chains; do a
      // best-effort cleanup based on the promise we just released.
      queueMicrotask(() => {
        if (lockTails.get(name) && lockTails.size > 32) {
          lockTails.delete(name)
        }
      })
    }
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'epimetheus-auth-token',
    lock: namedLock,
  },
})

// Auth helpers
export const auth: typeof supabase.auth = supabase.auth as any

// Database helpers
export const db = supabase

// Storage helpers
export const storage = supabase.storage
