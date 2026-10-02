import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Logo from './Logo';
import { Skeleton } from './ui/Skeleton';
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

export function LoadingSpinner({ size = "md", message, className }: { size?: "sm" | "md" | "lg"; message?: string; className?: string }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className || ''}`}>
      <div
        className={`${sizeClasses[size]} loading-spinner`}
      />
      {message && <p className="text-sm text-white/70">{message}</p>}
    </div>
  );
}

export { LoadingScreen };

/**
 * Minimal inline loading indicator — logo mark only.
 */
export function InlineLoader() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="flex items-center justify-center py-12"
      role="status"
      aria-label="Loading"
    >
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
        <Logo size="md" />
      </motion.div>
    </div>
  );
}

/**
 * Layout-matching placeholder for in-app pages. Mirrors the shell that
 * Layout.tsx renders (`<main class="pt-24 … min-h-screen pb-24 lg:pb-0">`)
 * so the skeleton occupies the same geometry as the page that replaces it —
 * no header jump, no scrollbar pop, no centered-spinner flash.
 */
export function PageSkeleton() {
  return (
    <main className="pt-24 flex flex-col min-h-screen pb-24 lg:pb-0" aria-hidden="true">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Page title block */}
        <div className="space-y-3">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        {/* Card grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        {/* Content panel */}
        <div className="space-y-3 rounded-xl border border-white/5 p-6">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </main>
  );
}

export function ContentSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-32" />
      <div className="space-y-2">
        <Skeleton className="h-3" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
}