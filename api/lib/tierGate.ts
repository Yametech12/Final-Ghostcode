import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedRequest, NormalizedResponse } from './handlers.js';

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
 * Caching: the per-user tier is cached in-memory for TIER_CACHE_TTL_MS so
 * back-to-back gated calls from the same user don't add a Supabase
 * round-trip per request. The TTL is shorter than the JWT cache (which
 * sits at 60s) so a Stripe webhook upgrading a tier propagates quickly.
 * The cache is invalidated on writes via `invalidateTierCache(userId)`,
 * which the relevant handlers (subscription update, stripe webhook) can
 * call when they exist.
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

const TIER_CACHE_TTL_MS = 30_000;        // 30s — short enough for billing flips
const MAX_TIER_CACHE_ENTRIES = 5_000;
const tierCache = new Map<string, TierEntry>();

function isTier(value: unknown): value is SubscriptionTier {
  return value === 'free' || value === 'strategist' || value === 'oracle';
}

/** Drop a cached tier so the next call re-reads from the DB. */
export function invalidateTierCache(userId: string): void {
  tierCache.delete(userId);
}

/** Test/debug helper. */
export function __resetTierCacheForTests(): void {
  tierCache.clear();
}

function getTierFromCache(userId: string, now: number): TierEntry | null {
  const entry = tierCache.get(userId);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    tierCache.delete(userId);
    return null;
  }
  // LRU recency refresh.
  tierCache.delete(userId);
  tierCache.set(userId, entry);
  return entry;
}

function setTierCache(userId: string, entry: TierEntry): void {
  if (tierCache.size >= MAX_TIER_CACHE_ENTRIES) {
    const firstKey = tierCache.keys().next().value;
    if (firstKey !== undefined) tierCache.delete(firstKey);
  }
  tierCache.set(userId, entry);
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

  let entry = getTierFromCache(userId, now);
  if (!entry) {
    const { data, error } = await supabase
      .from('users')
      .select('role, subscription_tier, subscription_expires_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      // Don't leak the DB error to the client; log and treat as unavailable.
      console.error('requireTier: users lookup failed:', error);
      return {
        status: 503,
        body: { error: 'Subscription check unavailable', code: 'SUBSCRIPTION_LOOKUP_FAILED' },
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
    if (!data) {
      const { error: upsertErr } = await supabase
        .from('users')
        .upsert(
          { id: userId, email: req.user.email ?? null },
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

    // Pin the cache to the shorter of TIER_CACHE_TTL_MS and the
    // subscription's own expiry — same idea as the JWT exp clamp in
    // auth.ts. We never want to serve a "still strategist" cache hit
    // past the moment the subscription actually expires.
    const ttlExpiry = now + TIER_CACHE_TTL_MS;
    const expiresAt = expiresAtClaim !== null ? Math.min(ttlExpiry, expiresAtClaim) : ttlExpiry;

    // Resolve isExpired against the original (uncapped) expiry, not the
    // cache's clamped one.
    const isExpired = expiresAtClaim !== null && expiresAtClaim < now;
    const effectiveTier: SubscriptionTier = isExpired ? 'free' : tier;

    entry = { role, tier: effectiveTier, expiresAt };
    if (expiresAt > now) {
      setTierCache(userId, entry);
    }
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
 * This piggybacks on the same in-memory cache as requireTier, so warm
 * paths skip the DB round-trip entirely.
 */
export async function getEffectiveTier(
  req: NormalizedRequest,
  supabase: SupabaseClient,
): Promise<{ tier: SubscriptionTier; isAdmin: boolean }> {
  if (!req.user) return { tier: 'free', isAdmin: false };
  const userId = req.user.id;
  const now = Date.now();

  let entry = getTierFromCache(userId, now);
  if (!entry) {
    const { data } = await supabase
      .from('users')
      .select('role, subscription_tier, subscription_expires_at')
      .eq('id', userId)
      .maybeSingle();

    const role: 'user' | 'admin' = data?.role === 'admin' ? 'admin' : 'user';
    const tier: SubscriptionTier = isTier(data?.subscription_tier)
      ? (data!.subscription_tier as SubscriptionTier)
      : 'free';
    const rawExpiry = data?.subscription_expires_at
      ? new Date(data.subscription_expires_at).getTime()
      : null;
    const expiresAtClaim = rawExpiry !== null && !Number.isNaN(rawExpiry) ? rawExpiry : null;
    const ttlExpiry = now + TIER_CACHE_TTL_MS;
    const expiresAt = expiresAtClaim !== null ? Math.min(ttlExpiry, expiresAtClaim) : ttlExpiry;
    const isExpired = expiresAtClaim !== null && expiresAtClaim < now;
    const effectiveTier: SubscriptionTier = isExpired ? 'free' : tier;

    entry = { role, tier: effectiveTier, expiresAt };
    if (expiresAt > now) setTierCache(userId, entry);
  }

  return { tier: entry.tier, isAdmin: entry.role === 'admin' };
}
