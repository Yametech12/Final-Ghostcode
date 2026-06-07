import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, Sparkles, ArrowRight, ArrowLeft, Check, Crown } from 'lucide-react';
import type { SubscriptionTier } from '../hooks/useSubscription';

interface PaywallScreenProps {
  /** The tier the user needs to access this content. */
  requiredTier: Exclude<SubscriptionTier, 'free'>;
  /** Human-friendly name of the locked feature, e.g. "AI Advisor". */
  featureName: string;
  /** One-liner pitch for why this feature is worth upgrading. */
  featurePitch?: string;
}

const TIER_PERKS: Record<Exclude<SubscriptionTier, 'free'>, string[]> = {
  strategist: [
    'AI Advisor (fair-use)',
    'Signal Decryptor',
    'Simulation Matrix',
    'Up to 25 Subject Dossiers',
    'Field Guide & Calibration',
  ],
  oracle: [
    'Everything in Strategist',
    'Unlimited Subject Dossiers',
    'Extended AI Advisor context (longer history & replies)',
    'Image attachments in AI chat',
    'Early access to new archetypes & modules',
    'Priority support',
  ],
};

// Headline price + per-month effective price when billed annually.
// Kept in sync with PLANS in PricingPage.tsx — when checkout goes live,
// both this file and that page need updating together.
const TIER_PRICE: Record<Exclude<SubscriptionTier, 'free'>, { monthly: number; annual: number }> = {
  strategist: { monthly: 14, annual: 12 },
  oracle: { monthly: 39, annual: 33 },
};

const TIER_LABEL: Record<Exclude<SubscriptionTier, 'free'>, string> = {
  strategist: 'Strategist',
  oracle: 'Oracle',
};

/**
 * Soft-lock screen shown when a free user hits paid content.
 *
 * Renders inside the existing app Layout (so the user keeps their nav and
 * can move around without feeling kicked out), and gives a clear path:
 * either upgrade or back out.
 */
export default function PaywallScreen({
  requiredTier,
  featureName,
  featurePitch = 'Unlock the full toolkit and stop guessing in the field.',
}: PaywallScreenProps) {
  const location = useLocation();
  const perks = TIER_PERKS[requiredTier];
  const price = TIER_PRICE[requiredTier];
  const tierLabel = TIER_LABEL[requiredTier];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto px-4 py-8 sm:py-12"
    >
      {/* Header strip */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to home
        </Link>
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate-500">
          {location.pathname}
        </span>
      </div>

      {/* Main paywall card */}
      <div className="glass-card relative overflow-hidden p-8 sm:p-12 text-center">
        {/* Soft gold glow background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(232,199,126,0.10) 0%, transparent 60%)',
            filter: 'blur(40px)',
          }}
        />

        <div className="relative z-10 space-y-6">
          {/* Lock icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 text-accent-primary mb-2">
            <Lock className="w-7 h-7" strokeWidth={1.5} aria-hidden="true" />
          </div>

          <span className="eyebrow inline-flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-accent-primary" aria-hidden="true" />
            {tierLabel} plan required
          </span>

          <h1 className="hero-headline text-4xl sm:text-5xl text-slate-50">
            {featureName} is <span className="text-gradient">locked.</span>
          </h1>

          <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">
            {featurePitch}
          </p>

          {/* Price callout */}
          <div className="inline-flex items-baseline gap-2 pt-2">
            {requiredTier === 'oracle' && (
              <Crown className="w-5 h-5 text-accent-primary self-center" aria-hidden="true" />
            )}
            <span className="hero-headline text-5xl text-slate-50 tabular-nums">
              ${price.monthly}
            </span>
            <span className="text-sm text-slate-500">/ month</span>
          </div>
          <p className="text-xs text-slate-500">
            Or ${requiredTier === 'strategist' ? 144 : 396}/yr billed annually · Paid checkout launching soon
          </p>

          {/* Perks */}
          <ul className="max-w-md mx-auto space-y-2.5 pt-4 text-left">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center shrink-0">
                  <Check
                    className="w-3 h-3 text-accent-primary"
                    aria-hidden="true"
                    strokeWidth={3}
                  />
                </span>
                <span className="text-slate-300 leading-relaxed">{perk}</span>
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6">
            <Link
              to="/pricing"
              className="group w-full sm:w-auto px-7 py-3.5 rounded-xl accent-gradient text-mystic-950 font-semibold tracking-wide shadow-xl shadow-accent-primary/15 transition-transform hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center gap-2"
            >
              Upgrade to {tierLabel}
              <ArrowRight
                className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <Link
              to="/"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white/5 border border-slate-700/30 text-slate-100 font-semibold tracking-wide hover:bg-white/8 hover:border-accent-primary/20 transition-all"
            >
              Maybe later
            </Link>
          </div>
        </div>
      </div>

      {/* Sub-note */}
      <p className="text-center text-xs text-slate-500 mt-6">
        Already upgraded?{' '}
        <Link to="/profile" className="text-accent-primary hover:underline">
          Refresh your profile
        </Link>
        {' '}to sync your subscription.
      </p>
    </motion.div>
  );
}
