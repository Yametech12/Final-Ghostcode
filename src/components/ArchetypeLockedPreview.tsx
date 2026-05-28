import { Link } from 'react-router-dom';
import { Lock, ArrowRight, Sparkles, BookOpen } from 'lucide-react';
import type { PersonalityProfile } from '../types';

interface ArchetypeLockedPreviewProps {
  profile: PersonalityProfile;
}

/**
 * Inline lock state for a single archetype on the encyclopedia page.
 *
 * Shows the archetype name, ID, ETS combination, and tagline (so the user
 * still sees what they'd be unlocking) but withholds the full body content.
 * Drops them into the pricing flow with a clear CTA.
 */
export default function ArchetypeLockedPreview({ profile }: ArchetypeLockedPreviewProps) {
  return (
    <div className="glass-card p-8 md:p-12 space-y-8 relative overflow-hidden">
      {/* Soft gold glow background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(232,199,126,0.08) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative z-10 space-y-8">
        {/* Header — same shape as the unlocked detail card so layout doesn't jump */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-accent-primary/10 text-accent-primary text-xs font-mono font-bold tracking-widest uppercase">
              <Lock className="w-3 h-3" aria-hidden="true" />
              {profile.combination}
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-50">
              {profile.name}
            </h1>
            <p className="text-xl text-accent-primary/80 font-medium italic">
              {profile.tagline}
            </p>
          </div>
          <div className="text-5xl md:text-7xl font-mono font-bold text-white/5 select-none">
            {profile.id}
          </div>
        </div>

        {/* Lock content */}
        <div className="border-t border-white/5 pt-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary shrink-0">
              <Lock className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div className="flex-1">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-accent-primary inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                Strategist plan required
              </span>
              <h2 className="hero-headline text-3xl text-slate-50 mt-2">
                Unlock {profile.name}'s full profile.
              </h2>
              <p className="text-slate-400 mt-2 leading-relaxed">
                The full encyclopedia entry includes her overview, key traits, core desires,
                interaction strategy, physicality, triggers, dating plan, and relationship
                dynamics. Your free Initiate tier covers two archetypes — TDI and TJI.
              </p>
            </div>
          </div>

          {/* What's inside the locked entry */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            {[
              'Character overview',
              'Key traits',
              'Core desires',
              'Interaction strategy',
              'Physicality & touch',
              'Dating plan',
              'Triggers & cold reads',
              'Relationship dynamics',
              'Compatibility profile',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm text-slate-400"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Link
              to="/pricing"
              className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl accent-gradient text-mystic-950 font-semibold tracking-wide shadow-xl shadow-accent-primary/15 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Upgrade to Strategist
              <ArrowRight
                className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <Link
              to="/encyclopedia?type=TDI"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-slate-700/30 text-slate-100 font-semibold tracking-wide hover:bg-white/8 hover:border-accent-primary/25 transition-all"
            >
              Read free archetypes
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
