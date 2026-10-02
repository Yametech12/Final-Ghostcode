import { useEffect, useState, type ReactNode } from 'react';
import LogoCanvas3D from './LogoCanvas3D';
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
 * across the entire site. The brand eye mark with a whisper of 3D
 * and premium fixed-source lighting (subtle coin-flip rotation,
 * 12s period). No rings, no titles, no progress bars.
 */
function BreathingLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizePx = { sm: 20, md: 32, lg: 48 }[size];

  return (
    <div aria-hidden="true">
      <LogoCanvas3D size={sizePx} />
    </div>
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