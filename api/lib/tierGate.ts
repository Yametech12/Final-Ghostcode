import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedRequest, NormalizedResponse } from './handlers.js';
import { cache, clearLocalCache } from './cache.js';

/**
 * Server-side subscription gating.
 *
 * The React layer enforces tier requirements via ProtectedRoute, but the
 * route guard runs in the user's browser — a free-tier user who knows the
 * URL can call /api/advisor/chat or /api/calibration/analyze directly with
 * a valid JWT and still get paid features. This helper closes that hole by
 * checking users.role and users.subscription_tier server-side before any
 * gated handler does work.
 *
 * Tier hierarchy (must stay in sync with src/hooks/useSubscription.ts):
 *   free       → 0
 *   strategist → 1
 *   oracle     → 2
 *
 * Admins (users.role = 'admin') always pass, the same way the client guard
 * lets them through every paywall for demo/debug purposes.
 *
 * Caching (two-tier):
 *   • Redis (`tier:<userId>`) holds the entry for REDIS_TIER_TTL_SEC so the
 *     tier survives across every serverless instance and region instead of
 *     being re-read from Supabase on every cold start.
 *   • A bounded process-local SHADOW cache (SHADOW_TTL_MS) sits in front of it
 *     so a burst of gated calls inside one warm instance skips the HTTP round
 *     trip to Upstash entirely.
 *
 * Both tiers store the same `TierEntry` shape and honour the same
 * `expiresAt`, which is the shorter of the TTL and the subscription's own
 * expiry — we never serve a "still strategist" hit past the moment the
 * subscription actually ends. `invalidateTierCache(userId)` drops both tiers,
 * which the subscription-update and Stripe webhook handlers call.
 */

export type SubscriptionTier = 'free' | 'strategist' | 'oracle';

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  strategist: 1,
  oracle: 2,
};

interface TierEntry {
  role: 'user' | 'admin';
  tier: SubscriptionTier;
  expiresAt: number; // wall-clock ms after which this entry is stale
}

const REDIS_TIER_TTL_SEC = 30;           // 30s — short enough for billing flips
const SHADOW_TTL_MS = 1_000;             // 1s — absorbs sub-second repeat calls
const MAX_SHADOW_ENTRIES = 1_000;

interface ShadowEntry extends TierEntry {
  shadowExpiresAt: number;
}

const shadowCache = new Map<string, ShadowEntry>();

function tierKey(userId: string): string {
  return `tier:${userId}`;
}

function isTier(value: unknown): value is SubscriptionTier {
  return value === 'free' || value === 'strategist' || value === 'oracle';
}

/** Guard against a foreign/garbage value coming back from a shared Redis. */
function isTierEntry(value: unknown): value is TierEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    (entry.role === 'user' || entry.role === 'admin') &&
    isTier(entry.tier) &&
    typeof entry.expiresAt === 'number' &&
    Number.isFinite(entry.expiresAt)
  );
}

function shadowGet(userId: string, now: number): ShadowEntry | null {
  const entry = shadowCache.get(userId);
  if (!entry) return null;
  if (entry.shadowExpiresAt <= now || entry.expiresAt <= now) {
    shadowCache.delete(userId);
    return null;
  }
  // LRU recency refresh.
  shadowCache.delete(userId);
  shadowCache.set(userId, entry);
  return entry;
}

function shadowSet(userId: string, entry: TierEntry, now: number): void {
  if (shadowCache.size >= MAX_SHADOW_ENTRIES) {
    const firstKey = shadowCache.keys().next().value;
    if (firstKey !== undefined) shadowCache.delete(firstKey);
  }
  shadowCache.set(userId, { ...entry, shadowExpiresAt: now + SHADOW_TTL_MS });
}

/** Drop a cached tier so the next call re-reads from the DB. */
export async function invalidateTierCache(userId: string): Promise<void> {
  shadowCache.delete(userId);
  await cache.del(tierKey(userId));
}

/**
 * Test/debug helper. Deliberately synchronous: the pre-existing suite calls it
 * in `beforeEach` without awaiting, and it only needs to clear process-local
 * state for the next case to observe a fresh DB read.
 */
export function __resetTierCacheForTests(): void {
  shadowCache.clear();
  clearLocalCache('tier:');
}

async function readTierEntry(userId: string, now: number): Promise<TierEntry | null> {
  const shadow = shadowGet(userId, now);
  if (shadow) return { role: shadow.role, tier: shadow.tier, expiresAt: shadow.expiresAt };

  const remote = await cache.get<TierEntry>(tierKey(userId));
  if (!remote || !isTierEntry(remote)) return null;
  if (remote.expiresAt <= now) return null;

  shadowSet(userId, remote, now);
  return remote;
}

async function writeTierEntry(userId: string, entry: TierEntry, now: number): Promise<void> {
  if (entry.expiresAt <= now) return;
  shadowSet(userId, entry, now);
  // Never outlive the subscription itself, and never exceed the base TTL.
  const ttlSec = Math.min(
    REDIS_TIER_TTL_SEC,
    Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
  );
  await cache.set(tierKey(userId), entry, ttlSec);
}

interface LoadResult {
  entry: TierEntry;
  /** True when the Supabase lookup errored — the entry is a 'free' default. */
  lookupFailed: boolean;
}

/**
 * Resolve the caller's tier entry, consulting shadow cache → Redis → Supabase.
 *
 * On a Supabase error the entry is NOT written to either cache tier: a
 * transient DB blip must not poison a *shared* Redis with a 'free' verdict for
 * 30s across every instance. `requireTier` turns `lookupFailed` into a 503
 * (same as before); `getEffectiveTier` falls back to 'free'.
 */
async function loadTierEntry(
  userId: string,
  req: NormalizedRequest,
  supabase: SupabaseClient,
  now: number,
  upsertIfMissing: boolean,
): Promise<LoadResult> {
  const cached = await readTierEntry(userId, now);
  if (cached) return { entry: cached, lookupFailed: false };

  const { data, error } = await supabase
    .from('users')
    .select('role, subscription_tier, subscription_expires_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return {
      entry: { role: 'user', tier: 'free', expiresAt: now + REDIS_TIER_TTL_SEC * 1000 },
      lookupFailed: true,
    };
  }

  // No row yet (e.g. brand-new sign-in race). Await an upsert so the
  // FK in handleCreateOracleAnalysis (and elsewhere) doesn't fail
  // immediately after sign-up. We block on this rather than fire-and-
  // forget because the previous behaviour rejected the very first
  // gated call after sign-in: cache wrote 'free', request returned
  // 402, but the upsert hadn't landed and the row was missing —
  // creating a confusing "you must upgrade, but actually we don't
  // even know you exist yet" state. The upsert is cheap (insert with
  // ON CONFLICT IGNORE) so the latency cost only hits truly first
  // calls.
  if (!data && upsertIfMissing) {
    const { error: upsertErr } = await supabase
      .from('users')
      .upsert(
        { id: userId, email: req.user?.email ?? null },
        { onConflict: 'id', ignoreDuplicates: true },
      );
    if (upsertErr) {
      // Failing the upsert is non-fatal for the gate decision (the
      // user still has 'free' tier semantics) but we surface it so
      // the tier check doesn't silently mask a deeper DB problem.
      console.error('requireTier: users upsert failed:', upsertErr);
    }
  }

  const role: 'user' | 'admin' = data?.role === 'admin' ? 'admin' : 'user';
  const tier: SubscriptionTier = isTier(data?.subscription_tier)
    ? (data!.subscription_tier as SubscriptionTier)
    : 'free';
  const rawExpiry = data?.subscription_expires_at
    ? new Date(data.subscription_expires_at).getTime()
    : null;
  const expiresAtClaim = rawExpiry !== null && !Number.isNaN(rawExpiry) ? rawExpiry : null;

  if (rawExpiry !== null && Number.isNaN(rawExpiry)) {
    console.warn('tier_gate_bad_expiry', {
      userId,
      raw: data?.subscription_expires_at,
    });
  }

  // Pin the cache to the shorter of REDIS_TIER_TTL_SEC and the
  // subscription's own expiry — same idea as the JWT exp clamp in
  // auth.ts. We never want to serve a "still strategist" cache hit
  // past the moment the subscription actually expires.
  const ttlExpiry = now + REDIS_TIER_TTL_SEC * 1000;
  const expiresAt = expiresAtClaim !== null ? Math.min(ttlExpiry, expiresAtClaim) : ttlExpiry;

  // Resolve isExpired against the original (uncapped) expiry, not the
  // cache's clamped one.
  const isExpired = expiresAtClaim !== null && expiresAtClaim < now;
  const effectiveTier: SubscriptionTier = isExpired ? 'free' : tier;

  const entry: TierEntry = { role, tier: effectiveTier, expiresAt };
  if (expiresAt > now) await writeTierEntry(userId, entry, now);

  return { entry, lookupFailed: false };
}

export async function requireTier(
  req: NormalizedRequest,
  supabase: SupabaseClient,
  required: 'strategist' | 'oracle'
): Promise<NormalizedResponse | null> {
  if (!req.user) {
    return {
      status: 401,
      body: { error: 'Authentication required', code: 'UNAUTHORIZED' },
    };
  }

  const userId = req.user.id;
  const now = Date.now();

  const { entry, lookupFailed } = await loadTierEntry(userId, req, supabase, now, true);

  if (lookupFailed) {
    // Don't leak the DB error to the client; log and treat as unavailable.
    console.error('requireTier: users lookup failed');
    return {
      status: 503,
      body: { error: 'Subscription check unavailable', code: 'SUBSCRIPTION_LOOKUP_FAILED' },
    };
  }

  // Admin override mirrors useSubscription.ts: admins always pass.
  if (entry.role === 'admin') return null;

  if (TIER_RANK[entry.tier] >= TIER_RANK[required]) return null;

  return {
    status: 402,
    body: {
      error: `This feature requires the ${required} plan`,
      code: 'PAYMENT_REQUIRED',
      requiredTier: required,
      currentTier: entry.tier,
    },
  };
}

/**
 * Read the caller's effective tier without enforcing a minimum. Useful for
 * handlers that already passed `requireTier(...)` and now need to branch
 * on whether the user is Oracle (e.g. larger token budget) or Strategist
 * (standard budget). Returns 'free' for unauthenticated requests.
 *
 * This shares the same two-tier cache as requireTier, so warm paths skip
 * both the Upstash round trip and the DB round trip entirely.
 */
export async function getEffectiveTier(
  req: NormalizedRequest,
  supabase: SupabaseClient,
): Promise<{ tier: SubscriptionTier; isAdmin: boolean }> {
  if (!req.user) return { tier: 'free', isAdmin: false };
  const userId = req.user.id;
  const now = Date.now();

  const { entry } = await loadTierEntry(userId, req, supabase, now, false);

  return { tier: entry.tier, isAdmin: entry.role === 'admin' };
}
