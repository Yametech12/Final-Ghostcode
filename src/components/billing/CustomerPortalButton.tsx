import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';

import { BillingError, createPortalSession } from '../../lib/billing';
import StripeError from './StripeError';

interface CustomerPortalButtonProps {
  /**
   * Optional Stripe customer ID. When omitted the server resolves the
   * caller's own stored customer (recommended — the client never needs to
   * know the ID, and the server rejects IDs belonging to other accounts).
   */
  customerId?: string;
  label?: string;
  className?: string;
}

/**
 * Opens the Stripe Customer Portal so the user can change plans, update
 * cards, or cancel — the self-serve management surface for paid users.
 * Rendered on the profile/settings page next to SubscriptionCard.
 */
export default function CustomerPortalButton({
  customerId,
  label = 'Manage billing',
  className = '',
}: CustomerPortalButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<BillingError | null>(null);

  const handleClick = async () => {
    setError(null);
    setLoading(true);
    try {
      const url = await createPortalSession(customerId);
      window.location.assign(url);
    } catch (err) {
      setError(
        err instanceof BillingError
          ? err
          : new BillingError('Unexpected error opening the billing portal.', 'UNKNOWN'),
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
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/30 bg-white/5 px-4 py-2 text-sm font-semibold tracking-wide text-slate-100 transition-all hover:border-accent-primary/25 hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        )}
        {loading ? 'Opening portal…' : label}
      </button>
      {error && <StripeError message={error.message} onDismiss={() => setError(null)} />}
    </div>
  );
}
