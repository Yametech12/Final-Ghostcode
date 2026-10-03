import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, ShieldCheck } from 'lucide-react';
import MarketingNav, { type MarketingNavLink } from '../components/layout/MarketingNav';
import MarketingFooter from '../components/layout/MarketingFooter';
import PayPalSubscribeButton from '../components/PayPalSubscribeButton';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { apiFetch } from '../lib/fetch';
import { toast } from 'sonner';

/**
 * Checkout page — PayPal subscription purchase for a paid plan.
 * Mounted at /checkout?plan=strategist|oracle&cycle=monthly|annual behind
 * ProtectedRoute (signed-in users only).
 */

type PlanParam = 'strategist' | 'oracle';
type CycleParam = 'monthly' | 'annual';

interface PlanConfig {
  key: string;
  tier: string;
  amount: string;
  currency: string;
  interval: string;
  label: string;
  planId: string | null;
  configured: boolean;
}

interface PayPalConfigResponse {
  clientId: string;
  mode: string;
  plans: PlanConfig[];
}

const PLAN_NAMES: Record<PlanParam, string> = {
  strategist: 'Strategist',
  oracle: 'Oracle',
};

function isPlanParam(v: string | null): v is PlanParam {
  return v === 'strategist' || v === 'oracle';
}

function isCycleParam(v: string | null): v is CycleParam {
  return v === 'monthly' || v === 'annual';
}

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useEnhancedAuth();

  const planParam = searchParams.get('plan');
  const cycleParam = searchParams.get('cycle');
  const validParams = isPlanParam(planParam) && isCycleParam(cycleParam);

  const [config, setConfig] = useState<PayPalConfigResponse | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const navLinks: MarketingNavLink[] = useMemo(
    () => [
      { label: 'Home', to: '/' },
      { label: 'Pricing', to: '/pricing' },
    ],
    [],
  );

  useEffect(() => {
    if (!validParams) {
      navigate('/pricing', { replace: true });
      return;
    }
    let cancelled = false;
    apiFetch('/api/paypal/config')
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error || 'Could not load checkout configuration.',
          );
        }
        setConfig((await res.json()) as PayPalConfigResponse);
      })
      .catch((err: Error) => {
        if (!cancelled) setConfigError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [validParams, navigate]);

  if (!validParams) return null;

  const planKey = `${planParam}-${cycleParam}`;
  const plan = config?.plans.find((p) => p.key === planKey) ?? null;
  const planReady = Boolean(plan?.configured && plan?.planId && config?.clientId);

  const handleApprove = async (subscriptionId: string) => {
    setConfirming(true);
    try {
      const res = await apiFetch('/api/paypal/subscriptions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId, planKey }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Subscription confirmation failed.');
      }
      toast.success(`${PLAN_NAMES[planParam]} activated. Welcome aboard.`);
      navigate('/profile');
    } catch (err) {
      setConfirming(false);
      throw err instanceof Error ? err : new Error('Subscription confirmation failed.');
    }
  };

  return (
    <div className="min-h-screen bg-mystic-950 text-slate-200">
      <MarketingNav links={navLinks} isSignedIn={!!auth?.user} homePath="/" />
      <main className="mx-auto w-full max-w-2xl px-6 pb-24 pt-28">
        <Link
          to="/pricing"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to pricing
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-50">
          Complete your subscription
        </h1>
        <p className="mt-2 text-slate-400">
          {auth?.userData?.displayName || auth?.user?.email
            ? `Checking out as ${auth?.userData?.displayName || auth?.user?.email}.`
            : 'Review your plan, then check out securely with PayPal.'}
        </p>

        {/* Order summary */}
        <section
          aria-label="Order summary"
          className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          {config === null && configError === null ? (
            <div className="flex items-center gap-3 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Loading checkout…
            </div>
          ) : configError ? (
            <div role="alert" className="text-sm text-red-200">
              {configError}
            </div>
          ) : (
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-lg font-semibold text-slate-50">
                  {PLAN_NAMES[planParam]} · {cycleParam === 'monthly' ? 'Monthly' : 'Annual'}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-400">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" aria-hidden />
                    Billed {cycleParam === 'monthly' ? 'every month' : 'once a year'} via PayPal
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" aria-hidden />
                    Cancel anytime from your PayPal account
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" aria-hidden />
                    14-day money-back guarantee
                  </li>
                </ul>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-slate-50">${plan?.amount ?? '—'}</p>
                <p className="text-sm text-slate-500">
                  USD / {cycleParam === 'monthly' ? 'month' : 'year'}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* PayPal checkout */}
        {planReady && plan?.planId && config && (
          <section aria-label="Payment" className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            {confirming ? (
              <div className="flex items-center justify-center gap-3 py-6 text-slate-300">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Confirming your subscription…
              </div>
            ) : (
              <>
                <PayPalSubscribeButton
                  clientId={config.clientId}
                  planId={plan.planId}
                  onApprove={handleApprove}
                  onError={(message) => toast.error(message)}
                  onCancel={() => toast.info('Checkout cancelled. No charge was made.')}
                />
                <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  Secure checkout — your payment details stay with PayPal.
                  {config.mode === 'sandbox' && ' (Sandbox test mode)'}
                </p>
              </>
            )}
          </section>
        )}

        {config && !planReady && !configError && (
          <div role="alert" className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            This plan is not available for checkout yet. Please try again later or contact support.
          </div>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
