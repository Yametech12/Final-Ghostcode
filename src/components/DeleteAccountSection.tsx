import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { apiFetch } from '../lib/fetch';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { parseApiError } from '../lib/apiError';

/**
 * Self-serve account deletion. Used at the bottom of ProfilePage so the
 * promise in PrivacyPage section 8 ("you can delete your account anytime")
 * is actually implementable.
 *
 * Friction model:
 *   • A "Delete account" button reveals a destructive confirmation modal.
 *   • The user has to type their account email back at us — exact match,
 *     case-insensitive, trimmed. This is the same shape the server checks
 *     in handleDeleteMyAccount, so a typo on either side fails closed.
 *   • On success we sign out locally so the auth context emits SIGNED_OUT
 *     and the user lands on the public root.
 */
export default function DeleteAccountSection() {
  const auth = useEnhancedAuth();
  const navigate = useNavigate();
  const user = auth?.user;
  const userEmail = (user?.email || '').toLowerCase();

  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track whether we set the critical-flow flag, so the unmount cleanup
  // below can clear it even if the user navigated away mid-flight.
  // Without this, the BACK button during deletion left
  // __epimetheus_critical_flow_in_flight stuck on `true`, and any later
  // unrelated render-phase error skipped SessionErrorBoundary's recovery.
  const criticalFlagOwnedRef = useRef(false);

  // Focus trap + Esc-to-close on the confirmation modal. Reuses the same
  // hook the existing modals use so behaviour is consistent.
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen, () => {
    if (!isDeleting) closeModal();
  });

  // If the component unmounts (browser BACK, route change, parent
  // re-render that drops us) while a deletion is mid-flight, the finally
  // block in handleDelete never runs. Clear the critical-flow flag here
  // so the rest of the app doesn't silently lose its error-recovery
  // boundary.
  useEffect(() => {
    return () => {
      if (criticalFlagOwnedRef.current && typeof window !== 'undefined') {
        (window as any).__epimetheus_critical_flow_in_flight = false;
        criticalFlagOwnedRef.current = false;
      }
    };
  }, []);

  if (!user) return null;

  const closeModal = () => {
    setIsOpen(false);
    setConfirmText('');
    setError(null);
  };

  const handleDelete = async () => {
    setError(null);
    if (confirmText.trim().toLowerCase() !== userEmail) {
      setError('That email does not match the account.');
      return;
    }
    setIsDeleting(true);
    // Tell SessionErrorBoundary to back off — if any unrelated component
    // throws while this destructive request is in flight, we don't want
    // the boundary to reload the page and silently abort the deletion.
    if (typeof window !== 'undefined') {
      (window as any).__epimetheus_critical_flow_in_flight = true;
      criticalFlagOwnedRef.current = true;
    }
    try {
      const res = await apiFetch('/api/users/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmText.trim() }),
      });
      if (!res.ok) {
        // Use the centralized parser so we surface the structured shape
        // (code + message) consistently with other API call sites.
        const parsed = await parseApiError(res);
        const code = parsed.code;
        const detail = parsed.message;

        // 401 mid-modal — token expired between modal open and confirm
        // click. Force a clean signOut so the user lands on the login
        // page instead of a stuck modal whose destructive button can
        // never succeed.
        if (res.status === 401) {
          toast.error('Your session expired. Please sign in again.');
          try { await auth?.signOut(); } catch { /* ignore */ }
          window.location.replace('/login');
          return;
        }

        switch (code) {
          case 'CONFIRM_REQUIRED':
          case 'CONFIRM_MISMATCH':
            // Recoverable inline. Keep the modal open so the user can
            // re-type the email correctly. Don't toast — the inline
            // <p role="alert"> announces it for screen readers.
            setError('That email does not match the account.');
            return;
          case 'NO_EMAIL':
            setError('This account has no email on file. Please contact support.');
            return;
          case 'RATE_LIMITED':
            setError(
              parsed.retryAfter
                ? `Too many delete attempts. Try again in ${parsed.retryAfter}s.`
                : 'Too many delete attempts. Try again in a few minutes.',
            );
            return;
          case 'DELETE_FAILED':
          default:
            throw new Error(detail || `Delete failed (${res.status})`);
        }
      }

      // Clear app-scoped localStorage BEFORE signOut so the next user on
      // this device doesn't inherit ghost data (assessment results,
      // oracle history, dossier cache, onboarding flags). The Supabase
      // auth keys (`sb-*`, `epimetheus-auth-*`) are intentionally left
      // alone — signOut is responsible for clearing those, and clearing
      // them prematurely causes a noisy SIGNED_OUT race.
      try {
        const keysToRemove = Object.keys(localStorage).filter(
          (k) =>
            k.startsWith('epimetheus_') ||
            k.startsWith('assessment_') ||
            k.startsWith('profiler_') ||
            k === 'oracleHistory' ||
            k === 'hasSeenOnboarding' ||
            k === 'hasSeenTour' ||
            k === 'loginAttempts' ||
            k === 'lockoutEndTime',
        );
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {
        /* ignore — privacy hygiene, not critical to delete success */
      }

      toast.success('Your account has been deleted.', { duration: 4000 });

      // Sign out and wait for SIGNED_OUT to actually propagate before
      // navigating. Without this, navigate('/') used to race with the
      // auth listener — we'd hit the route guard with `user` still
      // truthy for one render and bounce around before settling.
      try {
        if (auth?.signOutAndWait) {
          await auth.signOutAndWait(2500);
        } else if (auth?.signOut) {
          await auth.signOut();
        }
      } catch {
        // The server already deleted the user; the local supabase client
        // may also throw because the JWT is now invalid. That's fine —
        // we just want React state cleared.
      }
      // Soft client-side navigation. Auth state has propagated by now.
      navigate('/', { replace: true });
      // Defensive fallback: if for any reason auth state didn't clear
      // (e.g. signOutAndWait timed out), force a full reload so the user
      // can't end up on a stuck "deleted but still logged in" screen.
      setTimeout(() => {
        if (auth?.user) window.location.replace('/');
      }, 1500);
    } catch (err: any) {
      console.error('Account deletion error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to delete account';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
      if (typeof window !== 'undefined' && criticalFlagOwnedRef.current) {
        (window as any).__epimetheus_critical_flow_in_flight = false;
        criticalFlagOwnedRef.current = false;
      }
    }
  };

  return (
    <>
      <section className="mt-12 glass-card p-6 sm:p-8 border-status-error/20">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-status-error/10 border border-status-error/20 flex items-center justify-center text-status-error shrink-0">
            <AlertTriangle aria-hidden="true" className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-lg font-semibold text-slate-100">Danger zone</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Delete your account and every record we hold for you — assessments,
              calibrations, advisor history, dossiers, and field reports.
              Profile photos are removed from storage. This cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-status-error/10 border border-status-error/30 text-status-error font-semibold text-sm hover:bg-status-error/15 transition-colors"
            >
              <Trash2 aria-hidden="true" className="w-4 h-4" strokeWidth={1.75} />
              Delete account
            </button>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            role="presentation"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => !isDeleting && closeModal()}
              className="absolute inset-0 bg-mystic-950/80 backdrop-blur-md"
              aria-hidden="true"
            />

            <motion.div
              ref={trapRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              aria-describedby="delete-account-desc"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="relative w-full max-w-md bg-mystic-900/95 backdrop-blur-xl border border-status-error/30 rounded-2xl shadow-[0_24px_80px_-16px_rgba(0,0,0,0.65)] overflow-hidden"
            >
              <div className="p-6 border-b border-white/10 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-status-error/10 border border-status-error/20 flex items-center justify-center text-status-error shrink-0">
                    <AlertTriangle aria-hidden="true" className="w-5 h-5" />
                  </div>
                  <h2 id="delete-account-title" className="text-lg font-semibold text-slate-100">
                    Delete this account?
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isDeleting}
                  aria-disabled={isDeleting || undefined}
                  aria-label={isDeleting ? 'Cannot close while deleting' : 'Close'}
                  className="p-2 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                >
                  <X aria-hidden="true" className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-sm text-slate-300 leading-relaxed">
                <p id="delete-account-desc">
                  This permanently removes your assessments, calibrations,
                  advisor history, dossiers, favorites, field reports, and
                  uploaded photos. There is no undo.
                </p>
                <p>
                  To confirm, type your account email{' '}
                  <span className="font-mono text-accent-primary">{userEmail}</span>{' '}
                  below.
                </p>

                <label htmlFor="delete-confirm-input" className="sr-only">
                  Account email confirmation
                </label>
                <input
                  id="delete-confirm-input"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  spellCheck={false}
                  value={confirmText}
                  onChange={(e) => {
                    setConfirmText(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isDeleting}
                  placeholder={userEmail}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-status-error/50 transition-colors disabled:opacity-50"
                />
                {error && (
                  <p className="text-xs text-status-error" role="alert">
                    {error}
                  </p>
                )}
              </div>

              <div className="p-6 pt-0 flex flex-col-reverse sm:flex-row gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isDeleting}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-slate-700/30 text-slate-200 font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting || confirmText.trim().toLowerCase() !== userEmail}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-status-error/15 border border-status-error/40 text-status-error font-semibold hover:bg-status-error/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 aria-hidden="true" className="w-4 h-4" />
                      Delete forever
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
