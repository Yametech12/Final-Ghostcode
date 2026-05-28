import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  Check,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Crown,
  X,
  Menu,
} from 'lucide-react';
import Logo from '../components/Logo';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { useSubscription, type SubscriptionTier } from '../hooks/useSubscription';
import { toast } from 'sonner';

/**
 * Public pricing page — three-tier plan comparison plus FAQ.
 *
 * Mounted at /pricing. Not wrapped in PublicRoute so signed-in users can
 * still review plans from inside the app.
 */

type BillingCycle = 'monthly' | 'annual';

/**
 * Annual plans charge for 10 months but give 12 — a flat 16.7% discount
 * (the "two months free" pattern most SaaS uses). The numbers below show
 * the per-month rate when billed annually so users can compare apples to
 * apples on the card. The total annual charge is `annualMonthly * 12`.
 *
 * When Stripe goes live these prices need to be mirrored in the dashboard
 * Price IDs (see .env.example STRIPE_PRICE_*). Keep them in sync.
 */
interface Plan {
  id: 'initiate' | 'strategist' | 'oracle';
  /** Maps to the subscription tier in the database. */
  tier: SubscriptionTier;
  name: string;
  tagline: string;
  /** Headline price when billed monthly. */
  monthly: number;
  /** Effective per-month price when billed annually (= total / 12). */
  annualMonthly: number;
  highlight?: boolean;
  badge?: string;
  features: string[];
  excluded?: string[];
}

const PLANS: Plan[] = [
  {
    id: 'initiate',
    tier: 'free',
    name: 'Initiate',
    tagline: 'For the curious. Open the box.',
    monthly: 0,
    annualMonthly: 0,
    features: [
      'Full personality assessment',
      'Read your archetype profile',
      'Browse 2 free archetypes (TDI · TJI)',
      'Glossary and quick-reference',
      'Personality Profiler & Quiz',
    ],
    excluded: [
      '6 locked archetypes (NDI, NJI, TDR, TJR, NDR, NJR)',
      'AI Advisor',
      'Signal Decryptor',
      'Simulation Matrix',
      'Subject Dossiers',
    ],
  },
  {
    id: 'strategist',
    tier: 'strategist',
    name: 'Strategist',
    tagline: 'For the operator. The full toolkit.',
    monthly: 14,
    // $14 × 10 = $140/year billed annually → $11.67/mo effective.
    // Round to whole-dollar headline: $12/mo (12 × 12 = $144 annually).
    annualMonthly: 12,
    highlight: true,
    badge: 'Most popular',
    features: [
      'Everything in Initiate',
      'AI Advisor — fair-use limit (~30/min)',
      'Signal Decryptor',
      'Simulation Matrix — all scenarios',
      'Up to 25 Subject Dossiers',
      'Full Field Guide and tactical lines',
      'Calibration training mode',
    ],
  },
  {
    id: 'oracle',
    tier: 'oracle',
    name: 'Oracle',
    tagline: 'For the committed. The deepest playbook.',
    monthly: 39,
    // $39 × 10 = $390/year billed annually → $32.50/mo effective.
    // Round to $33 headline (33 × 12 = $396 annually).
    annualMonthly: 33,
    features: [
      'Everything in Strategist',
      'Unlimited Subject Dossiers',
      'Extended AI Advisor context (longer history, longer replies)',
      'Image attachments in AI chat',
      'Early access to new archetypes & modules (when released)',
      'Priority support',
    ],
  },
];

/**
 * Percent saved when billed annually vs the monthly price. Returns 0 for
 * free plans so we don't render a "Save 0%" badge.
 */
function savingsPercent(plan: Plan): number {
  if (plan.monthly <= 0) return 0;
  return Math.round((1 - plan.annualMonthly / plan.monthly) * 100);
}

const FAQ = [
  {
    q: 'Is there really a free tier?',
    a: 'Yes. Initiate is free forever — full assessment, your archetype profile, and the 8-archetype encyclopedia. No credit card required.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Once paid plans are live, you will be able to cancel with one click from your profile and keep access until the end of the billing period.',
  },
  {
    q: 'When can I upgrade?',
    a: 'Paid checkout is rolling out soon. In the meantime you can sign up free, take the assessment, and join the waitlist for Strategist and Oracle.',
  },
  {
    q: 'What payment methods will you accept?',
    a: 'All major credit cards via Stripe. Apple Pay and Google Pay on supported devices.',
  },
  {
    q: 'Will you offer refunds?',
    a: 'Yes. If something is not working for you in the first 14 days of a paid plan, email us and we will refund the most recent charge.',
  },
  {
    q: 'Is my data private?',
    a: 'Conversations and dossiers are stored in your authenticated account. We do not sell data. See our Privacy Policy for the full breakdown.',
  },
];

/**
 * Detailed plan comparison rows. `i` = Initiate, `s` = Strategist, `o` = Oracle.
 * `true`/`false` render as check/× icons; strings render as labels (e.g. "All 8").
 * Used by both the desktop comparison table and the mobile stacked view —
 * single source of truth so the two layouts can never drift.
 */
type ComparisonValue = boolean | string;
interface ComparisonRow {
  feature: string;
  i: ComparisonValue;
  s: ComparisonValue;
  o: ComparisonValue;
}
const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: 'Personality assessment', i: true, s: true, o: true },
  { feature: 'Browse archetypes', i: '2 free', s: 'All 8', o: 'All 8' },
  { feature: 'Glossary & quick-reference', i: true, s: true, o: true },
  { feature: 'Personality Profiler & Quiz', i: true, s: true, o: true },
  { feature: 'AI Advisor', i: false, s: 'Standard', o: 'Extended context' },
  { feature: 'Signal Decryptor', i: false, s: true, o: true },
  { feature: 'Simulation Matrix', i: false, s: true, o: true },
  { feature: 'Field Guide & tactical lines', i: false, s: true, o: true },
  { feature: 'Calibration training', i: false, s: true, o: true },
  { feature: 'Subject Dossiers', i: false, s: 'Up to 25', o: 'Unlimited' },
  { feature: 'Image attachments in AI chat', i: false, s: false, o: true },
  { feature: 'Longer AI replies', i: false, s: false, o: true },
  { feature: 'Early access to new modules', i: false, s: false, o: true },
  { feature: 'Priority support', i: false, s: false, o: true },
];

export default function PricingPage() {
  const [cycle, setCycle] = useState<BillingCycle>('annual');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const auth = useEnhancedAuth();
  const navigate = useNavigate();
  const sub = useSubscription();
  const isSignedIn = !!auth?.user;
  const reduceMotion = useReducedMotion();

  // Largest annual savings across paid plans, used to label the toggle.
  const maxSavings = Math.max(
    ...PLANS.filter((p) => p.monthly > 0).map(savingsPercent),
    0,
  );

  /**
   * Decide what action a tier card's CTA should do, given the viewer's state.
   *
   * Stripe checkout is not wired yet (Phase 2 work-in-progress). Until it is,
   * paid CTAs from logged-in users surface a "coming soon" toast instead of
   * silently routing them somewhere meaningless.
   */
  const handleCTA = (plan: Plan) => {
    // Logged-out users always go through registration first.
    if (!isSignedIn) {
      if (plan.tier === 'free') {
        navigate('/register');
      } else {
        // Preserve intent so register can show "you'll upgrade after sign up"
        navigate(`/register?intent=${plan.tier}`);
      }
      return;
    }

    // Admin: tell them they already have full access.
    if (sub.isAdmin) {
      toast.info('Admin accounts have full access to every feature.');
      return;
    }

    // User is already on this exact tier.
    if (sub.tier === plan.tier) {
      if (plan.tier === 'free') {
        toast.success('You are on the free Initiate plan.');
        navigate('/');
      } else {
        toast.success(`You are already on ${plan.name}.`);
        navigate('/profile');
      }
      return;
    }

    // Upgrade path — Stripe checkout not yet live.
    toast.info('Paid checkout is launching soon. We will email you when it goes live.');
  };

  /** Given the viewer's state, return the label and disabled-ness for a card CTA. */
  const ctaFor = (plan: Plan): { label: string; disabled: boolean; isCurrent: boolean } => {
    if (!isSignedIn) {
      if (plan.tier === 'free') return { label: 'Start free', disabled: false, isCurrent: false };
      return { label: 'Join waitlist', disabled: false, isCurrent: false };
    }
    if (sub.isAdmin) {
      return { label: 'Admin · full access', disabled: true, isCurrent: false };
    }
    if (sub.tier === plan.tier) {
      return { label: 'Current plan', disabled: true, isCurrent: true };
    }
    if (plan.tier === 'free') {
      // User is on a paid tier looking at free — downgrade hint.
      return { label: 'Manage in profile', disabled: false, isCurrent: false };
    }
    return { label: 'Upgrade', disabled: false, isCurrent: false };
  };

  return (
    <div className="min-h-screen bg-mystic-950 text-slate-200 overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent-primary focus:text-mystic-950 focus:font-semibold focus:shadow-lg"
      >
        Skip to content
      </a>
      <div className="atmosphere" aria-hidden="true" />

      {/* ───────────────────────── Top nav ───────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-mystic-950/80 backdrop-blur-xl safe-area-x">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/welcome" className="flex items-center gap-2 sm:gap-3 group min-w-0" aria-label="Epimetheus home">
            <Logo size="md" />
            <span className="hidden xs:inline hero-headline text-base sm:text-xl text-slate-50 tracking-tight group-hover:text-accent-primary transition-colors truncate">
              EPIMETHEUS
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400" aria-label="Primary">
            <Link to="/welcome" className="hover:text-slate-100 transition-colors">
              Home
            </Link>
            <Link to="/welcome#features" className="hover:text-slate-100 transition-colors">
              Features
            </Link>
            <span className="text-slate-100" aria-current="page">Pricing</span>
          </nav>

          <div className="flex items-center gap-2">
            {isSignedIn ? (
              <>
                <Link
                  to="/profile"
                  className="hidden sm:inline-block text-sm text-slate-300 hover:text-slate-50 px-3 py-2 transition-colors"
                >
                  Profile
                </Link>
                <Link
                  to="/"
                  className="text-sm font-semibold text-mystic-950 accent-gradient px-3 sm:px-4 py-2 rounded-xl shadow-lg shadow-accent-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform whitespace-nowrap"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline-block text-sm text-slate-300 hover:text-slate-50 px-3 py-2 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-semibold text-mystic-950 accent-gradient px-3 sm:px-4 py-2 rounded-xl shadow-lg shadow-accent-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform whitespace-nowrap"
                >
                  Get Started
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              aria-controls="pricing-mobile-nav"
              className="md:hidden p-2 rounded-xl text-slate-300 hover:text-slate-100 hover:bg-white/5 transition-colors"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* ───────────────────────── Mobile nav overlay ───────────────────────── */}
      {mobileNavOpen && (
        <div
          id="pricing-mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className="fixed inset-0 z-50 md:hidden bg-mystic-950/95 backdrop-blur-xl flex flex-col safe-area-top safe-area-bottom safe-area-x"
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
            <Link
              to="/welcome"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-2"
            >
              <Logo size="md" />
              <span className="hero-headline text-lg text-slate-50">EPIMETHEUS</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              className="p-2 rounded-xl text-slate-300 hover:text-slate-100 hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2 text-base" aria-label="Mobile primary">
            <Link
              to="/welcome"
              onClick={() => setMobileNavOpen(false)}
              className="block px-4 py-3 rounded-xl text-slate-200 hover:bg-white/5 transition-colors"
            >
              Home
            </Link>
            <Link
              to="/welcome#features"
              onClick={() => setMobileNavOpen(false)}
              className="block px-4 py-3 rounded-xl text-slate-200 hover:bg-white/5 transition-colors"
            >
              Features
            </Link>
            <span className="block px-4 py-3 rounded-xl text-accent-primary bg-accent-primary/5">
              Pricing
            </span>
            {isSignedIn ? (
              <Link
                to="/profile"
                onClick={() => setMobileNavOpen(false)}
                className="block px-4 py-3 rounded-xl text-slate-200 hover:bg-white/5 transition-colors"
              >
                Profile
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileNavOpen(false)}
                className="block px-4 py-3 rounded-xl text-slate-200 hover:bg-white/5 transition-colors"
              >
                Sign in
              </Link>
            )}
          </nav>
          <div className="px-4 py-4 border-t border-white/5">
            <Link
              to={isSignedIn ? '/' : '/register'}
              onClick={() => setMobileNavOpen(false)}
              className="block w-full text-center px-6 py-3 rounded-xl accent-gradient text-mystic-950 font-semibold shadow-lg shadow-accent-primary/15"
            >
              {isSignedIn ? 'Open dashboard' : 'Create free account'}
            </Link>
          </div>
        </div>
      )}

      {/* ───────────────────────── Hero ───────────────────────── */}
      <section
        id="main-content"
        className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 md:pt-24 pb-12 text-center"
      >
        <Link
          to="/welcome"
          className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to home
        </Link>

        <span className="eyebrow inline-flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-accent-primary" aria-hidden="true" />
          Pricing
        </span>

        <h1 className="hero-headline mt-6 text-4xl xs:text-5xl sm:text-6xl md:text-7xl text-slate-50 leading-[1.05]">
          Choose your <span className="text-gradient">depth.</span>
        </h1>

        <p className="mt-5 sm:mt-6 mx-auto max-w-2xl text-base sm:text-lg text-slate-400 leading-relaxed">
          Start free. Upgrade when the framework starts paying you back. Initiate gives you 2 free
          archetypes — Strategist unlocks the full encyclopedia and toolkit.
        </p>

        {/* Billing toggle.
            - Visible "Save N%" badge on the annual side gives the
              discount surface area without forcing users to hunt for it.
            - role="radiogroup" + aria-checked makes it readable as a
              two-way switch by screen readers (better than two toggle
              buttons that don't expose grouped semantics). */}
        <div
          className="mt-8 sm:mt-10 inline-flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10"
          role="radiogroup"
          aria-label="Billing cycle"
        >
          <button
            type="button"
            onClick={() => setCycle('monthly')}
            role="radio"
            aria-checked={cycle === 'monthly'}
            className={`px-4 sm:px-5 py-2 rounded-full text-sm font-medium transition-all ${
              cycle === 'monthly'
                ? 'bg-white/10 text-slate-50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setCycle('annual')}
            role="radio"
            aria-checked={cycle === 'annual'}
            className={`px-4 sm:px-5 py-2 rounded-full text-sm font-medium transition-all inline-flex items-center gap-2 ${
              cycle === 'annual'
                ? 'bg-white/10 text-slate-50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Annual
            {maxSavings > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider ${
                  cycle === 'annual'
                    ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                    : 'bg-status-success/15 text-status-success border border-status-success/30'
                }`}
              >
                Save {maxSavings}%
              </span>
            )}
          </button>
        </div>
      </section>

      {/* ───────────────────────── Pricing tiers ───────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24" aria-label="Plans">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
          {PLANS.map((plan, idx) => {
            const monthlyPrice = plan.monthly;
            const displayPrice = cycle === 'monthly' ? plan.monthly : plan.annualMonthly;
            const isFree = plan.monthly === 0;
            const isHighlight = plan.highlight;
            const cta = ctaFor(plan);
            const saved = savingsPercent(plan);
            const annualTotal = plan.annualMonthly * 12;

            return (
              <motion.div
                key={plan.id}
                initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: reduceMotion ? 0 : idx * 0.06 }}
                className={`relative glass-card p-7 sm:p-8 flex flex-col ${
                  isHighlight
                    ? 'border-accent-primary/40 shadow-[0_0_48px_-12px_rgba(232,199,126,0.25)] md:scale-[1.02] md:z-10'
                    : ''
                } ${cta.isCurrent ? 'border-status-success/40' : ''}`}
              >
                {plan.badge && !cta.isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-mystic-950 accent-gradient px-3 py-1.5 rounded-full whitespace-nowrap">
                      {plan.badge}
                    </span>
                  </div>
                )}
                {cta.isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-status-success bg-status-success/15 border border-status-success/40 px-3 py-1.5 rounded-full whitespace-nowrap">
                      Your plan
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-1">
                  {plan.id === 'oracle' && (
                    <Crown className="w-4 h-4 text-accent-primary" aria-hidden="true" />
                  )}
                  <h2 className="hero-headline text-3xl text-slate-50">{plan.name}</h2>
                </div>
                <p className="text-sm text-slate-500 mb-6">{plan.tagline}</p>

                <div className="mb-6 min-h-[88px]">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="hero-headline text-5xl text-slate-50 tabular-nums">
                      ${displayPrice}
                    </span>
                    {!isFree && (
                      <span className="text-sm text-slate-500">
                        / month
                      </span>
                    )}
                    {!isFree && cycle === 'annual' && saved > 0 && (
                      <span className="ml-1 text-xs font-mono px-2 py-0.5 rounded-full bg-status-success/15 text-status-success border border-status-success/30 tracking-wider">
                        −{saved}%
                      </span>
                    )}
                  </div>
                  {!isFree && cycle === 'annual' && (
                    <p className="mt-2 text-xs text-slate-500">
                      <span className="line-through text-slate-600 mr-1">
                        ${monthlyPrice * 12}
                      </span>
                      Billed ${annualTotal} once per year
                    </p>
                  )}
                  {!isFree && cycle === 'monthly' && (
                    <p className="mt-2 text-xs text-slate-500">
                      Billed monthly. Cancel anytime.
                    </p>
                  )}
                  {isFree && (
                    <p className="mt-2 text-xs text-slate-500">Free, forever</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleCTA(plan)}
                  disabled={cta.disabled}
                  aria-label={cta.isCurrent ? `${plan.name} — your current plan` : `${cta.label} — ${plan.name}`}
                  className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold tracking-wide transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                    cta.isCurrent
                      ? 'bg-status-success/10 border border-status-success/40 text-status-success'
                      : isHighlight
                      ? 'accent-gradient text-mystic-950 shadow-lg shadow-accent-primary/15 hover:scale-[1.02] active:scale-[0.98]'
                      : 'bg-white/5 border border-slate-700/30 text-slate-100 hover:bg-white/8 hover:border-accent-primary/25'
                  }`}
                >
                  {cta.isCurrent ? (
                    <>
                      <Check className="w-4 h-4" aria-hidden="true" strokeWidth={3} />
                      {cta.label}
                    </>
                  ) : (
                    <>
                      {cta.label}
                      {!cta.disabled && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
                    </>
                  )}
                </button>

                <ul className="mt-8 space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center shrink-0">
                        <Check
                          className="w-3 h-3 text-accent-primary"
                          aria-hidden="true"
                          strokeWidth={3}
                        />
                      </span>
                      <span className="text-slate-300 leading-relaxed">{f}</span>
                    </li>
                  ))}
                  {plan.excluded?.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-3 text-sm opacity-50"
                    >
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <span className="w-2 h-px bg-slate-500" aria-hidden="true" />
                      </span>
                      <span className="text-slate-500 line-through leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-8 sm:mt-10 text-center font-mono text-[10px] sm:text-[11px] tracking-[0.2em] sm:tracking-[0.25em] uppercase text-slate-500">
          USD · Paid plans rolling out soon · 14-day money-back guarantee
        </p>
      </section>

      {/* ───────────────────────── Comparison highlights ───────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-12">
          <span className="eyebrow">What every plan includes</span>
          <h2 className="hero-headline text-3xl sm:text-4xl text-slate-50">
            The fundamentals, free.
          </h2>
          <p className="text-slate-400">
            We do not gate the doctrine. The framework, the archetypes, and the assessment are
            yours from the first sign-up.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: ShieldCheck,
              t: 'Privacy-first',
              d: 'Encrypted at rest. We do not sell data. You can export or delete anytime.',
            },
            {
              icon: Sparkles,
              t: 'Active development',
              d: 'New scenarios, archetypes, and modules ship monthly — included.',
            },
            {
              icon: Crown,
              t: 'Built on the framework',
              d: 'Every feature derives from the EPIMETHEUS behavioral system — the same doctrine taught privately.',
            },
          ].map((item) => (
            <div key={item.t} className="glass-card p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-accent-primary/10 border border-accent-primary/15 flex items-center justify-center text-accent-primary">
                <item.icon className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100">{item.t}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{item.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────────── Detailed comparison table ───────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-12">
          <span className="eyebrow">Compare in detail</span>
          <h2 className="hero-headline text-3xl sm:text-4xl text-slate-50">
            What's in each plan.
          </h2>
        </div>

        {/*
          Two layouts:
          - md+ : full comparison table (3 columns)
          - <md : stacked per-plan accordion lists. Horizontal scroll for a
                  16-row table on a phone is genuinely awful UX, even with
                  min-w/overflow-x. The stacked version preserves all the
                  same info but in a thumb-friendly layout.
          The data is shared between both — see COMPARISON_ROWS.
        */}
        <div className="hidden md:block glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-5 text-slate-300 font-semibold">Feature</th>
                  <th className="p-5 text-center text-slate-300 font-semibold">Initiate</th>
                  <th className="p-5 text-center text-accent-primary font-semibold">
                    Strategist
                  </th>
                  <th className="p-5 text-center text-slate-300 font-semibold">Oracle</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr
                    key={row.feature}
                    className={`border-b border-white/5 ${idx % 2 === 1 ? 'bg-white/[0.015]' : ''}`}
                  >
                    <td className="p-4 sm:p-5 text-slate-300">{row.feature}</td>
                    {[row.i, row.s, row.o].map((v, i) => (
                      <td key={i} className="p-4 sm:p-5 text-center">
                        {v === true ? (
                          <Check
                            className="w-5 h-5 text-accent-primary mx-auto"
                            strokeWidth={2.5}
                            aria-label="Included"
                          />
                        ) : v === false ? (
                          <X
                            className="w-4 h-4 text-slate-700 mx-auto"
                            strokeWidth={2}
                            aria-label="Not included"
                          />
                        ) : (
                          <span className="text-slate-300 font-mono text-xs tracking-wider">
                            {v}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile: per-plan stacked summary. Each plan section lists every
            row from COMPARISON_ROWS so the user can compare without
            scrolling sideways. Initiate first because that's the entry. */}
        <div className="md:hidden space-y-5">
          {(['Initiate', 'Strategist', 'Oracle'] as const).map((planLabel, idx) => {
            const key = (['i', 's', 'o'] as const)[idx];
            const isHighlight = planLabel === 'Strategist';
            return (
              <div
                key={planLabel}
                className={`glass-card p-5 ${isHighlight ? 'border-accent-primary/30' : ''}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3
                    className={`hero-headline text-2xl ${
                      isHighlight ? 'text-accent-primary' : 'text-slate-50'
                    }`}
                  >
                    {planLabel}
                  </h3>
                  {isHighlight && (
                    <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-accent-primary/15 border border-accent-primary/30 text-accent-primary">
                      Most popular
                    </span>
                  )}
                </div>
                <ul className="space-y-2.5 text-sm">
                  {COMPARISON_ROWS.map((row) => {
                    const v = row[key];
                    return (
                      <li
                        key={row.feature}
                        className="flex items-start justify-between gap-3"
                      >
                        <span
                          className={`flex-1 ${
                            v === false ? 'text-slate-600' : 'text-slate-300'
                          }`}
                        >
                          {row.feature}
                        </span>
                        <span className="shrink-0">
                          {v === true ? (
                            <Check
                              className="w-4 h-4 text-accent-primary"
                              strokeWidth={2.5}
                              aria-label="Included"
                            />
                          ) : v === false ? (
                            <X
                              className="w-4 h-4 text-slate-700"
                              strokeWidth={2}
                              aria-label="Not included"
                            />
                          ) : (
                            <span className="text-accent-primary font-mono text-xs tracking-wider">
                              {v}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────────────────────── Guarantee strip ───────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="glass-card p-7 sm:p-9 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary shrink-0">
            <ShieldCheck className="w-7 h-7" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="hero-headline text-2xl text-slate-50">
              14-day money-back guarantee.
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Try Strategist or Oracle. If the framework isn't paying you back inside two weeks,
              email us — we'll refund the full amount, no questions asked.
            </p>
          </div>
        </div>
      </section>

      {/* ───────────────────────── FAQ ───────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center space-y-4 mb-12">
          <span className="eyebrow">FAQ</span>
          <h2 className="hero-headline text-3xl sm:text-4xl text-slate-50">
            Common questions.
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <details
              key={i}
              className="glass-card p-5 sm:p-6 group cursor-pointer"
            >
              <summary className="flex items-center justify-between gap-4 list-none">
                <h3 className="text-base sm:text-lg font-semibold text-slate-100 group-hover:text-accent-primary transition-colors">
                  {item.q}
                </h3>
                <span
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-accent-primary shrink-0 transition-transform group-open:rotate-45"
                  aria-hidden="true"
                >
                  <span className="text-lg leading-none">+</span>
                </span>
              </summary>
              <p className="mt-4 text-sm text-slate-400 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ───────────────────────── CTA ───────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="glass-card p-8 sm:p-14 text-center relative overflow-hidden shimmer-effect">
          <div className="relative z-10 space-y-6">
            <h2 className="hero-headline text-3xl sm:text-5xl text-slate-50">
              Ready to <span className="text-gradient">read the room?</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              {isSignedIn
                ? 'Jump back in. The framework only deepens with use.'
                : 'Take the assessment. Meet your archetype. Decide if you want more from there.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {isSignedIn ? (
                <>
                  <Link
                    to="/"
                    className="group w-full sm:w-auto px-8 py-4 rounded-xl accent-gradient text-mystic-950 font-semibold tracking-wide shadow-xl shadow-accent-primary/15 transition-transform hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center gap-2"
                  >
                    Go to dashboard
                    <ArrowRight
                      className="w-5 h-5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                  <Link
                    to="/profile"
                    className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 border border-slate-700/30 text-slate-100 font-semibold tracking-wide hover:bg-white/8 hover:border-accent-primary/20 transition-all"
                  >
                    Manage profile
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="group w-full sm:w-auto px-8 py-4 rounded-xl accent-gradient text-mystic-950 font-semibold tracking-wide shadow-xl shadow-accent-primary/15 transition-transform hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center gap-2"
                  >
                    Start free
                    <ArrowRight
                      className="w-5 h-5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                  <Link
                    to="/login"
                    className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 border border-slate-700/30 text-slate-100 font-semibold tracking-wide hover:bg-white/8 hover:border-accent-primary/20 transition-all"
                  >
                    I already have an account
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Footer ───────────────────────── */}
      <footer className="border-t border-white/5 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span>© {new Date().getFullYear()} Yame Coaching · EPIMETHEUS</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/welcome" className="hover:text-slate-200 transition-colors">
              Home
            </Link>
            <Link to="/terms" className="hover:text-slate-200 transition-colors">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-slate-200 transition-colors">
              Privacy
            </Link>
            <Link to="/login" className="hover:text-slate-200 transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
