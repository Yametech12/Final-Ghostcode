import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';

interface LoadingScreenProps {
  progress?: number;
  message?: string;
  timeout?: number;
  onTimeout?: () => void;
}

const loadingMessages = [
  'Initializing system...',
  'Connecting to the Shadow Network...',
  'Loading personality matrix...',
  'Calibrating hunter assessment engine...',
  'Syncing field intelligence...',
  'System online.',
];

export default function LoadingScreen({
  progress,
  message,
  timeout = 15000,
  onTimeout,
}: LoadingScreenProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [fakeProgress, setFakeProgress] = useState(0);

  // Cycle through loading messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % loadingMessages.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // Fake progress bar that fills smoothly
  useEffect(() => {
    const interval = setInterval(() => {
      setFakeProgress(prev => {
        if (prev >= 90) return prev; // Stall at 90% until real load completes
        return prev + Math.random() * 12;
      });
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Show "taking longer" after 5s
  useEffect(() => {
    const slowTimer = setTimeout(() => setIsSlowConnection(true), 5000);
    return () => clearTimeout(slowTimer);
  }, []);

  // Hard timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTimedOut(true);
      onTimeout?.();
    }, timeout);
    return () => clearTimeout(timer);
  }, [timeout, onTimeout]);

  const handleRefresh = () => {
    try {
      const keysToRemove = Object.keys(localStorage).filter(k =>
        k.startsWith('epimetheus-auth') || k.startsWith('sb-')
      );
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
    window.location.reload();
  };

  const displayProgress = progress !== undefined ? progress : Math.min(fakeProgress, 95);

  return (
    <div className="fixed inset-0 bg-mystic-950 flex items-center justify-center z-[9999] overflow-hidden">
      {/* Animated grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(232,199,126,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(232,199,126,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Scanning line */}
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-primary/60 to-transparent"
        initial={{ top: '0%' }}
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />

      {/* Background glow orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-1/3 left-1/4 w-48 h-48 md:w-72 md:h-72 bg-accent-primary/8 rounded-full blur-[100px]"
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/3 right-1/4 w-48 h-48 md:w-72 md:h-72 bg-accent-secondary/6 rounded-full blur-[100px]"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="w-full max-w-sm mx-auto flex flex-col items-center relative z-10 px-6">
        {/* Logo with glow ring */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          className="relative mb-8"
        >
          {/* Pulsing ring behind logo */}
          <motion.div
            className="absolute -inset-4 rounded-2xl border border-accent-primary/20"
            animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -inset-8 rounded-3xl border border-accent-primary/10"
            animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.03, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          />
          <Logo size="lg" className="glow-accent relative z-10" />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-center mb-6"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-gradient">EPIMETHEUS</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.25em] mt-1 font-mono">
            Hunter Assessment System
          </p>
        </motion.div>

        {/* Progress bar */}
        {!isTimedOut && (
          <motion.div
            initial={{ opacity: 0, width: '60%' }}
            animate={{ opacity: 1, width: '100%' }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="w-full max-w-[280px] mb-4"
          >
            <div className="h-1 bg-mystic-800 rounded-full overflow-hidden border border-slate-700/30">
              <motion.div
                className="h-full accent-gradient rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${displayProgress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[9px] font-mono text-slate-600 tabular-nums">{Math.round(displayProgress)}%</span>
              <span className="text-[9px] font-mono text-slate-600">LOADING</span>
            </div>
          </motion.div>
        )}

        {/* Status message */}
        <div className="min-h-[40px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={isTimedOut ? 'timeout' : messageIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="text-slate-400 text-xs tracking-wide text-center font-mono"
            >
              {isTimedOut
                ? '⚠ Connection failed.'
                : (message || loadingMessages[messageIndex])}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Slow connection warning */}
        {isSlowConnection && !isTimedOut && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] text-slate-600 mt-3 font-mono"
          >
            Weak signal detected... retrying
          </motion.p>
        )}

        {/* Timeout state */}
        {isTimedOut && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 mt-4"
          >
            <p className="text-[10px] text-slate-500 text-center font-mono">
              Network issue or stale session detected.
            </p>
            <button
              onClick={handleRefresh}
              className="px-6 py-2.5 rounded-xl accent-gradient text-mystic-950 text-sm font-semibold tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-accent-primary/15"
            >
              Reconnect
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
