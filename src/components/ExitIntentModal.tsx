import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';

const SESSION_KEY = 'epimetheus_exit_intent_shown';

/**
 * Exit-intent recovery modal for the marketing surface.
 *
 * Fires once per session when a desktop visitor's cursor leaves the top of
 * the viewport (classic exit-intent signal). Never fires on touch devices
 * (no cursor), never fires for signed-in users, and never fires twice.
 *
 * The offer is the free assessment — the product's core value — not a
 * discount trick. Fully dismissible: X button, backdrop click, Escape.
 */
export default function ExitIntentModal() {
  const [isOpen, setIsOpen] = useState(false);
  const auth = useEnhancedAuth();
  const isSignedIn = !!auth?.user;

  const close = useCallback(() => {
    setIsOpen(false);
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* storage unavailable — modal just won't re-fire this mount */
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      return;
    }
    // Touch devices have no cursor — exit intent is meaningless there.
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const onMouseOut = (e: MouseEvent) => {
      // Cursor left through the top edge = heading for tabs/address bar.
      if (e.clientY <= 0 && !e.relatedTarget) {
        setIsOpen(true);
        document.removeEventListener('mouseout', onMouseOut);
      }
    };
    document.addEventListener('mouseout', onMouseOut);
    return () => document.removeEventListener('mouseout', onMouseOut);
  }, [isSignedIn]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-mystic-950/85 backdrop-blur-md"
            onClick={close}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-intent-title"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.25 }}
            className="relative w-full max-w-md glass-card p-8 text-center"
          >
            <button
              onClick={close}
              aria-label="Close"
              className="absolute top-3 right-3 p-2 rounded-full text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 text-accent-primary mb-5">
              <Sparkles className="w-6 h-6" aria-hidden="true" />
            </div>

            <h2 id="exit-intent-title" className="hero-headline text-2xl sm:text-3xl text-slate-50 mb-3">
              Before you go —
              <br />
              the first read is free.
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Take the 2-minute assessment and meet your archetype. No credit card,
              no commitment — just the framework, working.
            </p>

            <div className="space-y-3">
              <Link
                to="/register"
                onClick={close}
                className="group w-full px-6 py-3.5 rounded-xl accent-gradient text-mystic-950 font-semibold tracking-wide shadow-xl shadow-accent-primary/15 transition-transform hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center gap-2"
              >
                Start my free assessment
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <button
                onClick={close}
                className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
              >
                No thanks, I&apos;ll keep guessing
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
