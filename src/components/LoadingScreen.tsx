import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Logo from './Logo';

interface LoadingScreenProps {
  timeout?: number;
  onTimeout?: () => void;
}

/**
 * Full-screen loading state — logo only.
 *
 * A single centered logo with a barely-there breathing animation.
 * No titles, no progress bars, no status messages. On timeout it shows
 * a quiet retry affordance.
 */
export default function LoadingScreen({
  timeout = 15000,
  onTimeout,
}: LoadingScreenProps) {
  const [isTimedOut, setIsTimedOut] = useState(false);
  const reduceMotion = useReducedMotion();

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
          <Logo size="lg" aria-hidden="true" />
          <p className="text-sm text-slate-400">
            This is taking longer than expected.
          </p>
          <button
            onClick={handleRetry}
            className="text-sm text-slate-300 underline underline-offset-4 decoration-slate-600 hover:text-slate-100 hover:decoration-slate-400 transition-colors"
          >
            Try again
          </button>
        </div>
      ) : (
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
          <Logo size="lg" />
        </motion.div>
      )}
    </div>
  );
}
