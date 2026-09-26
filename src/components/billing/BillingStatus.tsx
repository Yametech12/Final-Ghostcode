import { useEnhancedAuth } from '../../contexts/EnhancedAuthContext';

const TIER_LABEL: Record<'free' | 'strategist' | 'oracle', string> = {
  free: 'Initiate',
  strategist: 'Strategist',
  oracle: 'Oracle',
};

/**
 * Compact billing summary: current tier + next renewal/expiry date.
 *
 * Data source: the EnhancedAuthContext user row (subscriptionTier /
 * subscriptionExpiresAt from the users table) — the same single source of
 * truth useSubscription and the server-side tierGate read. The webhook
 * keeps these columns current, so this stays accurate without its own
 * endpoint. Used on the profile/settings page.
 */
export default function BillingStatus() {
  const { userData } = useEnhancedAuth();

  const tier = userData?.subscriptionTier ?? 'free';
  const expiresAt = userData?.subscriptionExpiresAt
    ? new Date(userData.subscriptionExpiresAt)
    : null;
  const isExpired = expiresAt !== null && expiresAt.getTime() < Date.now();
  const isPaid = tier !== 'free' && !isExpired;

  const formatted = expiresAt
    ? expiresAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      data-testid="billing-status"
      className="rounded-xl border border-slate-700/30 bg-white/5 px-4 py-3 text-sm"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate-500">
          Current plan
        </span>
        <span
          className={`font-mono text-[10px] tracking-[0.2em] uppercase ${
            isPaid ? 'text-accent-primary' : 'text-slate-400'
          }`}
        >
          {isExpired ? 'Expired' : TIER_LABEL[tier]}
        </span>
      </div>
      <p className="mt-1 text-slate-300">
        {isPaid && formatted && `Renews on ${formatted}`}
        {isPaid && !formatted && 'Active subscription'}
        {isExpired && 'Your subscription has expired — features reverted to Initiate.'}
        {tier === 'free' && !isExpired && 'Free tier — upgrade any time from the pricing page.'}
      </p>
    </div>
  );
}
