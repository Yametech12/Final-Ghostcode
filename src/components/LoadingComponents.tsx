import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Logo from './Logo';
import LoadingScreen from './LoadingScreen';
import '../styles/loading.css';

/**
 * How long to wait before showing a lazy-route/guard fallback. Fast chunk
 * loads and warm route caches resolve well under this, so users never see
 * a flash of skeleton for content that is already ready.
 */
const FALLBACK_DELAY_MS = 180;

/**
 * Delays rendering its children by FALLBACK_DELAY_MS (180ms).
 *
 * Wrap Suspense/guard fallbacks with this so sub-180ms loads render no
 * loading UI at all — eliminating the skeleton flicker on quick in-app
 * navigations — while slow loads still get a purposeful skeleton instead
 * of a frozen viewport.
 */
export function DelayedFallback({ children, delay = FALLBACK_DELAY_MS }: { children: ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;
  return <>{children}</>;
}

/**
 * Logo-only loading indicator — the single consistent loading visual
 * across the entire site. A centered logo with a subtle breathing animation.
 * No rings, no titles, no progress bars.
 */
function BreathingLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      initial={reduceMotion ? false : { opacity: 0.45 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: [0.45, 1, 0.45] }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
      }
    >
      <Logo size={size} />
    </motion.div>
  );
}

export function LoadingSpinner({ size = "md", className }: { size?: "sm" | "md" | "lg"; message?: string; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center ${className || ''}`}
      role="status"
      aria-label="Loading"
    >
      <BreathingLogo size={size} />
    </div>
  );
}

export { LoadingScreen };

/**
 * Minimal inline loading indicator — logo mark only.
 */
export function InlineLoader() {
  return (
    <div
      className="flex items-center justify-center py-12"
      role="status"
      aria-label="Loading"
    >
      <BreathingLogo size="md" />
    </div>
  );
}

/**
 * Page-level loading state — logo only, centered in the page shell.
 * Used as the Suspense fallback for lazy routes and auth guards so every
 * route transition shows the same loading visual.
 */
export function PageSkeleton() {
  return (
    <main
      className="pt-24 flex flex-col items-center justify-center min-h-screen pb-24 lg:pb-0"
      role="status"
      aria-label="Loading"
    >
      <BreathingLogo size="lg" />
    </main>
  );
}

export function ContentSkeleton() {
  return (
    <div
      className="flex items-center justify-center py-12"
      role="status"
      aria-label="Loading"
    >
      <BreathingLogo size="md" />
    </div>
  );
}