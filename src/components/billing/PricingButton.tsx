import { useState } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';

import { BillingError, createCheckoutSession } from '../../lib/billing';
import StripeError from './StripeError';

interface PricingButtonProps {
  /** The plan to check out. Only paid tiers can be purchased. */
  tier: 'strategist' | 'oracle';
  /** Button label. Defaults to "Upgrade". */
  label?: string;
  /** Extra classes for the wrapper (spacing in parent layouts). */
  className?: string;
}

/**
 * Starts Stripe Checkout: calls POST /api/billing/create-checkout-session
 * and does a full-page redirect to the returned Stripe-hosted URL.
 * Full redirect (not a popup) — Checkout is designed for it and it keeps
 * the flow working inside in-app browsers.
 */
export default function PricingButton({ tier, label = 'Upgrade', className = '' }: PricingButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BillingError | null>(null);

  const handleClick = async () => {
    setError(null);
    setLoading(true);
    try {
      const url = await createCheckoutSession(tier);
      window.location.assign(url);
      // No setLoading(false): the page is navigating away.
    } catch (err) {
      setError(
        err instanceof BillingError
          ? err
          : new BillingError('Unexpected error starting checkout. Please try again.', 'UNKNOWN'),
      );
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-busy={loading}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 accent-gradient text-mystic-950 font-semibold tracking-wide shadow-lg shadow-accent-primary/15 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        )}
        {loading ? 'Redirecting to checkout…' : label}
      </button>
      {error && <StripeError message={error.message} onDismiss={() => setError(null)} />}
    </div>
  );
}
