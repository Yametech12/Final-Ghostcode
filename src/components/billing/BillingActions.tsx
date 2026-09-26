/**
 * Composite billing block for the profile page:
 * live tier + renewal status, plus the Stripe Customer Portal button for
 * paid users (self-serve plan changes / cancellation / card updates).
 */
import { useSubscription } from '../../hooks/useSubscription';
import BillingStatus from './BillingStatus';
import CustomerPortalButton from './CustomerPortalButton';

export default function BillingActions() {
  const sub = useSubscription();
  return (
    <div className="mt-3 flex flex-col gap-3">
      <BillingStatus />
      {sub.tier !== 'free' && <CustomerPortalButton className="self-start" />}
    </div>
  );
}
