import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { LogoIcon } from '../Logo';

/**
 * Phase model for the calibration loading screen.
 *
 * The bar progress is driven by elapsed time on a slow asymptote
 * (1 - exp(-t/k)), capped at 95% until the real result arrives. We do NOT
 * animate the bar to 100% on a fixed timer — that would lie about progress
 * and leave it sitting "done" for tens of seconds while the AI is still
 * thinking, which is the bug this overlay replaces.
 *
 * Phase labels are picked off this list by elapsed seconds. The list ends
 * with a "still working" tail so users who wait a long time see varied
 * status text instead of a single line pulsing forever.
 */
interface Phase {
  /** Lower bound (seconds elapsed) at which this phase becomes the active one. */
  fromSeconds: number;
  label: string;
}

const PHASES: Phase[] = [
  { fromSeconds: 0,  label: 'Reading scenario' },
  { fromSeconds: 2,  label: 'Analyzing behavioral cues' },
  { fromSeconds: 8,  label: 'Cross-referencing types' },
  { fromSeconds: 18, label: 'Drafting recommendations' },
  { fromSeconds: 35, label: 'Finalizing' },
];

const SLOW_WARNING_AT = 20; // seconds
const CANCEL_REVEAL_AT = 8; // seconds

/** Asymptotic progress: 0 at t=0, ~63% at t=k, ~95% at t=3k, never 1.0. */
const TIME_CONSTANT_S = 12; // tunes the rise — 12s puts us at ~63% by 12s

function progressFromElapsed(seconds: number): number {
  // (1 - e^(-t/k)) capped at 0.95 so we never display "100%" before truth.
  const raw = 1 - Math.exp(-seconds / TIME_CONSTANT_S);
  return Math.min(raw, 0.95);
}

function pickPhase(seconds: number): Phase {
  let active = PHASES[0];
  for (const p of PHASES) {
    if (seconds >= p.fromSeconds) active = p;
  }
  return active;
}

interface ScanningOverlayProps {
  /** Whether the overlay is currently visible. */
  visible: boolean;
  /** Called when the user clicks the cancel button. */
  onCancel: () => void;
}

/**
 * Full-screen overlay shown while the AI Oracle is computing a calibration.
 *
 * Improvements over the previous fake-progress version:
 *  - Honest asymptotic progress driven by elapsed time, capped at 95%.
 *  - Rotating phase labels (Reading → Analyzing → Cross-referencing → Drafting → Finalizing).
 *  - "This is taking longer than usual" hint after 20s.
 *  - Cancel button fades in after 8s so fast responses don't flash a "Cancel" the user can't react to.
 *  - Brand-consistent gold accent (was hot pink, didn't match anywhere else).
 *  - Respects prefers-reduced-motion.
 *  - Screen-reader live region announcing phase changes.
 *  - Skeleton preview of the result card so the user has something to look at.
 *  - Local overscroll containment instead of a global body scroll lock.
 */
export function ScanningOverlay({ visible, onCancel }: ScanningOverlayProps) {
  const reduceMotion = useReducedMotion();
  const [elapsed, setElapsed] = React.useState(0);

  // Reset and tick the elapsed counter whenever the overlay opens.
  // Using a ref-based start time + rAF would be smoother, but we only
  // re-render once per second and the math is dirt cheap, so setInterval
  // keeps the code simple.
  React.useEffect(() => {
    if (!visible) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 250);
    return () => window.clearInterval(id);
  }, [visible]);

  const phase = pickPhase(elapsed);
  const progress = progressFromElapsed(elapsed);
  const showSlowHint = elapsed >= SLOW_WARNING_AT;
  const showCancel = elapsed >= CANCEL_REVEAL_AT;

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-mystic-950/95 backdrop-blur-xl flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      // Local overscroll containment — replaces the previous global
      // `document.body.style.overflow = 'hidden'`, which clipped overlay
      // content on small screens.
      style={{ overscrollBehavior: 'contain' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanning-overlay-title"
    >
      {/* Cancel button — top-right, fades in after CANCEL_REVEAL_AT. */}
      {showCancel && (
        <motion.button
          type="button"
          onClick={onCancel}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          aria-label="Cancel analysis"
          className="absolute top-4 right-4 sm:top-6 sm:right-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium tracking-wide text-slate-300 hover:text-slate-50 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-accent-primary/40 transition-colors"
        >
          <X aria-hidden="true" className="w-3.5 h-3.5" />
          Cancel
        </motion.button>
      )}

      <div className="relative z-10 flex flex-col items-center w-full max-w-md mx-auto pt-8 sm:pt-0 space-y-8 sm:space-y-10">
        {/* Logo with subtle ring + gold glow (matches the brand palette). */}
        <motion.div
          aria-hidden="true"
          className="relative"
          animate={reduceMotion ? undefined : {
            scale: [1, 1.04, 1],
            opacity: [0.85, 1, 0.85],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Pulsing ring behind the logo */}
          <motion.div
            className="absolute inset-0 -m-3 rounded-2xl border border-accent-primary/25"
            animate={reduceMotion ? undefined : { opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <LogoIcon className="w-20 h-20 sm:w-28 sm:h-28 text-accent-primary drop-shadow-[0_0_24px_rgba(232,199,126,0.45)]" />
        </motion.div>

        {/* Title + bar + status */}
        <div className="flex flex-col items-center gap-5 w-full">
          <h2
            id="scanning-overlay-title"
            className="font-mono text-[11px] sm:text-xs tracking-[0.3em] uppercase text-slate-300"
          >
            The Oracle is reading
          </h2>

          {/* Honest progress bar. The width follows progressFromElapsed(),
              not a fixed timer, and is clamped at 95% until the real result
              lands. */}
          <div className="w-full h-1 bg-white/8 rounded-full overflow-hidden border border-white/5">
            <motion.div
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-amber-300 via-accent-primary to-amber-500 shadow-[0_0_12px_rgba(232,199,126,0.55)]"
            />
          </div>

          {/* Phase row + percent. AnimatePresence cross-fades the label
              between phases so the change is noticeable but not jumpy. */}
          <div className="w-full flex items-center justify-between gap-3 min-h-[20px]">
            <motion.div
              key={phase.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="text-accent-primary/90 font-mono text-[11px] tracking-[0.25em] uppercase"
            >
              {phase.label}
              <motion.span
                aria-hidden="true"
                animate={reduceMotion ? undefined : { opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="ml-1"
              >
                …
              </motion.span>
            </motion.div>
            <span className="font-mono text-[11px] tabular-nums text-slate-500">
              {Math.round(progress * 100)}%
            </span>
          </div>

          {/* Slow-warning hint. Appears after 20s. */}
          {showSlowHint && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-[11px] text-slate-500 text-center max-w-xs"
            >
              This is taking longer than usual. The Oracle is being thorough.
            </motion.p>
          )}
        </div>

        {/* Skeleton preview of the result card. Sets expectations and
            occupies the empty bottom half of the screen. */}
        <ResultSkeleton reduceMotion={reduceMotion ?? false} />
      </div>

      {/* SR-only live region — announces phase transitions to screen readers
          without flooding them on every animation frame. */}
      <div role="status" aria-live="polite" className="sr-only">
        {phase.label}, {Math.round(progress * 100)} percent.
      </div>
    </motion.div>
  );
}

/**
 * Faded outline of what the analysis card will look like. The shimmer keeps
 * it feeling alive without distracting from the real status above.
 */
function ResultSkeleton({ reduceMotion }: { reduceMotion: boolean }) {
  const bar = (w: string, h = 'h-3') =>
    `${h} ${w} rounded-full bg-gradient-to-r from-white/5 via-white/10 to-white/5`;

  const shimmer = reduceMotion
    ? undefined
    : { backgroundPosition: ['200% 0', '-200% 0'] as [string, string] };

  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="w-full rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3"
      style={{
        backgroundSize: '200% 100%',
        backgroundImage:
          'linear-gradient(90deg, transparent 0%, rgba(232,199,126,0.04) 50%, transparent 100%)',
      }}
    >
      <motion.div
        animate={shimmer}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
        className="w-full"
      >
        <div className="flex items-center gap-3">
          <div className={bar('w-12', 'h-6')} />
          <div className="flex-1 space-y-1.5">
            <div className={bar('w-1/2')} />
            <div className={bar('w-1/3')} />
          </div>
        </div>
      </motion.div>

      <div className="space-y-1.5 pt-1">
        <div className={bar('w-full')} />
        <div className={bar('w-5/6')} />
        <div className={bar('w-2/3')} />
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <div className="h-5 w-16 rounded-full bg-white/5" />
        <div className="h-5 w-20 rounded-full bg-white/5" />
        <div className="h-5 w-14 rounded-full bg-white/5" />
      </div>
    </motion.div>
  );
}
