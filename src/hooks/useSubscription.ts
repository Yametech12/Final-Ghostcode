import { useMemo } from 'react';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';

export type SubscriptionTier = 'free' | 'strategist' | 'oracle';

/**
 * Tier hierarchy. Higher index = more access.
 * Used to compare "does this user's tier meet the required tier?"
 */
const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  strategist: 1,
  oracle: 2,
};

interface SubscriptionState {
  /** Current tier from the users row. */
  tier: SubscriptionTier;
  /** True if the user has any paid plan (strategist or oracle) and not expired. */
  isPaid: boolean;
  /** True if the user is an admin — they bypass all paywalls. */
  isAdmin: boolean;
  /** True if the subscription is past its expiry date (still here for grace UX). */
  isExpired: boolean;
  /**
   * Returns true if the user can access content gated at `requiredTier`.
   * Admins always pass. Free users can only access free content.
   */
  canAccess: (requiredTier: SubscriptionTier) => boolean;
}

/**
 * Single source of truth for subscription gating in the React layer.
 *
 * Admin override: anyone with `userData.role === 'admin'` bypasses every
 * tier check. This is intentional — admins demo the product, debug, and
 * test paid flows without needing to spoof billing state.
 */
export function useSubscription(): SubscriptionState {
  const { userData } = useEnhancedAuth();

  return useMemo(() => {
    const tier: SubscriptionTier = userData?.subscriptionTier ?? 'free';
    const isAdmin = userData?.role === 'admin';
    const expiresAt = userData?.subscriptionExpiresAt
      ? new Date(userData.subscriptionExpiresAt).getTime()
      : null;
    const isExpired = expiresAt !== null && expiresAt < Date.now();

    // Paid means tier is paid AND not expired. Admin counts as paid for UI purposes.
    const isPaid = isAdmin || (tier !== 'free' && !isExpired);

    const canAccess = (requiredTier: SubscriptionTier) => {
      if (isAdmin) return true;
      if (isExpired && requiredTier !== 'free') return false;
      return TIER_RANK[tier] >= TIER_RANK[requiredTier];
    };

    return { tier, isPaid, isAdmin, isExpired, canAccess };
  }, [userData]);
}
