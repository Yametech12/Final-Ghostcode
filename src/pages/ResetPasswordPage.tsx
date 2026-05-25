import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Lock, ArrowRight, ArrowLeft, Loader2, AlertCircle,
  Eye, EyeOff, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { getSupabaseErrorMessage, isValidEmail } from '../utils/errorHandling';
import { sanitizeInput } from '../utils/validation';
import Logo from '../components/Logo';

/**
 * Reset password page handles two distinct flows:
 *
 *   1. "request" mode (default): user enters their email, we send the
 *      Supabase recovery email. The redirectTo lives in the auth context.
 *
 *   2. "recovery" mode: triggered when Supabase emits PASSWORD_RECOVERY
 *      after `detectSessionInUrl` consumes the recovery token from the URL
 *      hash. While in this mode the user can call updateUser({ password })
 *      to set their new password without supplying the old one.
 *
 * The mode is decided once on mount and never reverts inside the component
 * lifecycle to avoid confusing state transitions while the user is typing.
 */

type Mode = 'request' | 'recovery';

const passwordChecks = (pw: string) => {
  const errors: string[] = [];
  if (pw.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(pw)) errors.push('One uppercase letter');
  if (!/[a-z]/.test(pw)) errors.push('One lowercase letter');
  if (!/[0-9]/.test(pw)) errors.push('One number');
  return errors;
};

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { resetPassword } = useEnhancedAuth();

  // Decide the mode from the URL hash on the very first render. Supabase puts
  // a `type=recovery` (and `access_token`) into the hash on the redirect.
  const initialMode: Mode = (() => {
    if (typeof window === 'undefined') return 'request';
    const hash = window.location.hash || '';
    return hash.includes('type=recovery') ? 'recovery' : 'request';
  })();

  const [mode, setMode] = useState<Mode>(initialMode);

  // Listen for PASSWORD_RECOVERY in case the auth listener fires after we
  // mount (Supabase processes the hash asynchronously on some browsers).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('recovery');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // ── Request flow state ────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  // ── Recovery flow state ───────────────────────────────────────────────
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  // ── Shared state ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pwErrors = password ? passwordChecks(password) : [];
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const recoveryFormValid = pwErrors.length === 0 && passwordsMatch;

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPassword(email);
      setRequestSent(true);
    } catch (err) {
      setError(getSupabaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryFormValid) return;
    setLoading(true);
    setError('');
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;
      setRecoverySuccess(true);
      toast.success('Password updated. Redirecting…');
      // Give the user a beat to read the success state, then route them home.
      // The session is already authenticated at this point — no re-login needed.
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch (err) {
      setError(getSupabaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0508] to-[#1a0f15] p-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl">
        <div className="flex justify-center mb-6">
          <Logo size="xl" />
        </div>

        {mode === 'request' ? (
          <>
            <h1 className="hero-headline text-3xl text-slate-50 mb-2 text-center">
              Reset Password
            </h1>
            <p className="text-slate-400 mb-6 text-center">
              {requestSent
                ? "Check your inbox for the reset link"
                : "Enter your email and we'll send you a reset link"}
            </p>

            {requestSent ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                  <p className="text-sm text-green-300 text-center">
                    If an account exists for <span className="font-medium">{email}</span>, a
                    password reset link is on its way.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-primary/90 text-white font-bold py-3 rounded-xl transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleRequest} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        const sanitized = sanitizeInput(e.target.value);
                        setEmail(sanitized);
                        setEmailError(
                          sanitized && !isValidEmail(sanitized)
                            ? 'Please enter a valid email address'
                            : ''
                        );
                      }}
                      className={`w-full bg-white/5 border rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-primary/50 transition-all ${
                        emailError ? 'border-red-500/50' : 'border-white/10'
                      }`}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                  {emailError && (
                    <div className="text-xs text-red-400">{emailError}</div>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email || !!emailError}
                  className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-primary/90 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send reset link
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Back to sign in
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <h1 className="hero-headline text-3xl text-slate-50 mb-2 text-center">
              Set new password
            </h1>
            <p className="text-slate-400 mb-6 text-center">
              {recoverySuccess
                ? 'Your password has been updated.'
                : 'Choose a strong password you have not used before.'}
            </p>

            {recoverySuccess ? (
              <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
                <p className="text-sm text-green-300 text-center">
                  Redirecting you home…
                </p>
              </div>
            ) : (
              <form onSubmit={handleRecovery} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    New password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full bg-white/5 border rounded-xl py-3 pl-10 pr-10 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-primary/50 transition-all ${
                        password && pwErrors.length === 0
                          ? 'border-green-500/50'
                          : 'border-white/10'
                      }`}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {password && pwErrors.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {pwErrors.map((err, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1 text-xs text-red-400"
                        >
                          <div className="w-1 h-1 rounded-full bg-red-400" />
                          {err}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full bg-white/5 border rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-primary/50 transition-all ${
                        confirmPassword && passwordsMatch
                          ? 'border-green-500/50'
                          : confirmPassword
                            ? 'border-red-500/50'
                            : 'border-white/10'
                      }`}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  {confirmPassword && !passwordsMatch && (
                    <div className="text-xs text-red-400">
                      Passwords do not match
                    </div>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !recoveryFormValid}
                  className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-primary/90 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Updating…
                    </>
                  ) : (
                    <>
                      Update password
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
