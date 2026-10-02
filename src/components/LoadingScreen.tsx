import { useState, useEffect } from 'react';
import LogoCanvas3D from './LogoCanvas3D';

interface LoadingScreenProps {
  timeout?: number;
  onTimeout?: () => void;
}

/**
 * Full-screen loading state — logo only, with a whisper of 3D and light.
 *
 * A single centered logo carrying the same subtle 2D-projected rotation
 * and fixed-source lighting as the site's constellation emblems
 * (12s coin-flip, never gimmicky). No titles, no progress bars,
 * no status messages. On timeout it shows a quiet retry affordance.
 */
export default function LoadingScreen({
  timeout = 15000,
  onTimeout,
}: LoadingScreenProps) {
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTimedOut(true);
      onTimeout?.();
    }, timeout);
    return () => clearTimeout(timer);
  }, [timeout, onTimeout]);

  const handleRetry = () => {
    try {
      const keysToRemove = Object.keys(localStorage).filter(k =>
        k.startsWith('epimetheus-auth') || k.startsWith('sb-')
      );
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 bg-mystic-950 flex items-center justify-center z-[9999]"
      role="status"
      aria-label="Loading"
    >
      {isTimedOut ? (
        <div className="flex flex-col items-center gap-4 px-6 text-center">
          <LogoCanvas3D size={48} />
          <p className="text-sm text-slate-400">
            This is taking longer than expected.
          </p>
          <button type="button"
            onClick={handleRetry}
            className="text-sm text-slate-300 underline underline-offset-4 decoration-slate-600 hover:text-slate-100 hover:decoration-slate-400 transition-colors"
          >
            Try again
          </button>
        </div>
      ) : (
        <div aria-hidden="true">
          <LogoCanvas3D size={48} />
        </div>
      )}
    </div>
  );
}
