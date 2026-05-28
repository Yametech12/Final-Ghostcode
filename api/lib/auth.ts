/// <reference lib="dom" />
import { createHash } from 'node:crypto';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Verify a Supabase JWT from the Authorization header.
 *
 * Returns the authenticated user on success, or null if the header is
 * missing/invalid.
 *
 * Server routes that handle user data MUST derive userId from this function;
 * never trust a client-supplied userId in the body or query string.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * In-process token cache
 * ─────────────────────────────────────────────────────────────────────────
 * Each request to a Vercel serverless function (or the Express dev server)
 * previously hit Supabase Auth's `/auth/v1/user` endpoint to verify the
 * JWT. That round-trip costs ~30-150 ms warm and adds latency to every
 * authenticated endpoint, including streaming `/api/advisor/chat` where it
 * directly delays time-to-first-token.
 *
 * We cache the verified `User` keyed by SHA-256(token) for up to
 * `POSITIVE_TTL_MS`. Negative results (invalid tokens) are cached for a
 * shorter `NEGATIVE_TTL_MS` so a flood of bad tokens doesn't hammer
 * Supabase, but we don't want to lock out a user who quickly recovers a
 * valid session. Cache entries are also clamped to the JWT's own `exp`
 * claim — even if TTL hasn't elapsed, we never serve a cached entry past
 * the token's stated expiry.
 *
 * Tradeoffs:
 *   • Admin force-signout takes up to POSITIVE_TTL_MS to propagate. For a
 *     1h-default token TTL, a 60s cache is acceptable.
 *   • The cache lives in process memory, so it doesn't survive cold starts
 *     and isn't shared across function invocations. That's fine — warm
 *     functions on Vercel handle most steady-state traffic.
 *
 * Key safety:
 *   • We hash the token instead of using the raw string as the Map key, so
 *     accidental logging of cache internals can't leak a usable JWT.
 */

const POSITIVE_TTL_MS = 60_000;   // 60s for verified users
const NEGATIVE_TTL_MS = 5_000;    // 5s for invalid tokens
// Bound the cache so a long-lived process can't OOM under token churn.
// Each entry is ~1-2 KB (User object + metadata), so 10k entries ≈ 15-20
// MB — comfortable on every Vercel function memory tier. The previous
// 1k cap thrashed at saturation (>10k unique tokens/hour), driving the
// hit rate below 10% and effectively negating the cache.
const MAX_CACHE_ENTRIES = 10_000;

type CacheEntry = {
  user: User | null; // null = negative cache
  expiresAt: number; // wall-clock ms after which the entry is stale
};

const tokenCache = new Map<string, CacheEntry>();

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Best-effort decode of the JWT `exp` claim. Returns the expiry as a ms
 * timestamp, or null if the token is malformed. We do NOT verify the
 * signature here — Supabase's `auth.getUser` does that on the cache miss
 * path; this is purely so we don't extend a token's lifetime past its own
 * stated expiry.
 */
function readJwtExpiryMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    // base64url → base64. Node's atob accepts padded base64.
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    if (typeof payload?.exp === 'number') {
      return payload.exp * 1000; // exp is seconds since epoch
    }
  } catch {
    // malformed; fall through
  }
  return null;
}

function getCached(key: string, now: number): CacheEntry | null {
  const entry = tokenCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    tokenCache.delete(key);
    return null;
  }
  // Refresh LRU recency by re-inserting.
  tokenCache.delete(key);
  tokenCache.set(key, entry);
  return entry;
}

function setCached(key: string, entry: CacheEntry): void {
  // Evict oldest when full. Map iteration order is insertion order so the
  // first entry is the least-recently-touched.
  if (tokenCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = tokenCache.keys().next().value;
    if (firstKey !== undefined) tokenCache.delete(firstKey);
  }
  tokenCache.set(key, entry);
}

/** Test/debug helper. Not exported elsewhere. */
export function __resetAuthCacheForTests(): void {
  tokenCache.clear();
}

export async function getAuthenticatedUser(
  authHeader: string | undefined,
  supabase: SupabaseClient
): Promise<User | null> {
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth] No Authorization header or missing Bearer prefix.');
    }
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const now = Date.now();
  const cacheKey = hashToken(token);

  const cached = getCached(cacheKey, now);
  if (cached) {
    return cached.user;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[auth] supabase.auth.getUser failed:', error?.message || 'no user returned');
      }
      // Negative cache: short TTL so a transient outage doesn't lock the
      // user out for long, but enough to absorb a retry storm.
      setCached(cacheKey, { user: null, expiresAt: now + NEGATIVE_TTL_MS });
      return null;
    }

    // Clamp the positive-cache TTL to the JWT's own exp claim so we never
    // serve a cached User after the token would naturally expire. The
    // small safety margin (-1s) prevents the rare race where the cache
    // returns a User in the same millisecond the token expires.
    const jwtExp = readJwtExpiryMs(token);
    const ttlExpiry = now + POSITIVE_TTL_MS;
    const expiresAt = jwtExp !== null ? Math.min(ttlExpiry, jwtExp - 1_000) : ttlExpiry;

    // If the token has already expired (or is within the 1s safety margin),
    // don't cache; let the next request go straight to Supabase to surface
    // the invalid-token error.
    if (expiresAt > now) {
      setCached(cacheKey, { user: data.user, expiresAt });
    }
    return data.user;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[auth] Exception in getAuthenticatedUser:', err);
    }
    // Don't poison the cache on transient exceptions (network blips). The
    // next request will retry against Supabase.
    return null;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(uuid: string | undefined | null): boolean {
  return typeof uuid === 'string' && UUID_REGEX.test(uuid);
}
