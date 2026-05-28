import { Link } from 'react-router-dom';
import { Crown, Sparkles, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';

/**
 * Subscription summary card for the profile page.
 *
 * Surfaces the user's current tier, what's unlocked, and the upgrade path.
 * Admins see a special "Admin · full access" state — all gates are bypassed
 * for them at the route level so a plan label would be misleading.
 */
export default function SubscriptionCard() {
  const sub = useSubscription();

  // Admin override view
  if (sub.isAdmin) {
    return (
      <div className="glass-card p-6 sm:p-7 relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-status-info/10 border border-status-info/20 flex items-center justify-center text-status-info shrink-0">
            <ShieldCheck className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-status-info">
                Admin
              </span>
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate-500">
                · full access
              </span>
            </div>
            <h3 className="text-lg font-semibold text-slate-100">All features unlocked</h3>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              Admin accounts bypass every paywall. Use this to demo, debug, and verify
              paid flows without billing.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tierMeta = {
    free: {
      label: 'Initiate',
      tagline: 'Free tier',
      icon: Sparkles,
      iconClass: 'bg-slate-700/40 border-slate-700/50 text-slate-300',
      desc: 'Assessment + 8-archetype encyclopedia.',
    },
    strategist: {
      label: 'Strategist',
      tagline: 'Most popular',
      icon: Zap,
      iconClass: 'bg-accent-primary/10 border-accent-primary/20 text-accent-primary',
      desc: 'Full toolkit — Advisor, Decryptor, Simulation, up to 25 Dossiers, Field Guide, Calibration.',
    },
    oracle: {
      label: 'Oracle',
      tagline: 'Deepest playbook',
      icon: Crown,
      iconClass: 'bg-accent-primary/15 border-accent-primary/30 text-accent-primary',
      desc: 'Strategist toolkit + unlimited Dossiers, extended AI Advisor context, image attachments, and priority support.',
    },
  } as const;

  const meta = tierMeta[sub.tier];
  const Icon = meta.icon;
  const isPaid = sub.tier !== 'free';

  return (
    <div className="glass-card p-6 sm:p-7 relative overflow-hidden">
      {isPaid && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(232,199,126,0.10) 0%, transparent 65%)',
            filter: 'blur(30px)',
          }}
        />
      )}

      <div className="relative z-10">
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${meta.iconClass}`}
          >
            <Icon className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent-primary">
                Current plan
              </span>
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-slate-500">
                · {meta.tagline}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-slate-100">{meta.label}</h3>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">{meta.desc}</p>

            {sub.isExpired && (
              <p className="mt-3 inline-flex items-center gap-2 text-xs text-status-warning bg-status-warning/10 border border-status-warning/20 rounded-lg px-3 py-1.5">
                Subscription expired — features have reverted to Initiate.
              </p>
            )}

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              {sub.tier === 'free' ? (
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl accent-gradient text-mystic-950 text-sm font-semibold tracking-wide shadow-lg shadow-accent-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  Upgrade
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              ) : (
                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-slate-700/30 text-slate-100 text-sm font-semibold tracking-wide hover:bg-white/8 hover:border-accent-primary/25 transition-all"
                >
                  Manage plan
                </Link>
              )}
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-slate-400 text-sm hover:text-slate-100 transition-colors"
              >
                Compare plans
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
