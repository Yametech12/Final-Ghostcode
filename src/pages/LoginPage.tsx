import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, Eye, EyeOff, Clock, Fingerprint } from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';
import { toast } from 'sonner';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { getSupabaseErrorMessage, isValidEmail } from '../utils/errorHandling';
import { sanitizeInput } from '../utils/validation';
import Logo from '../components/Logo';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export default function LoginPage() {
  const navigate = useNavigate();
  const { signInWithEmail, signInWithGoogle } = useEnhancedAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  // Password strength calculation
  const passwordStrength = React.useMemo(() => {
    if (!password) return { strength: 'None', width: '0%', color: 'gray' };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    const strengthMap = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const widthMap = ['20%', '40%', '60%', '80%', '100%'];
    const colorMap = ['red', 'orange', 'yellow', 'blue', 'green'];
    return {
      strength: strengthMap[score - 1] || 'None',
      width: widthMap[score - 1] || '0%',
      color: colorMap[score - 1] || 'gray'
    };
  }, [password]);

  const passwordErrors = React.useMemo(() => {
    const errors: string[] = [];
    if (password && password.length < 8) errors.push('At least 8 characters');
    if (password && !/[A-Z]/.test(password)) errors.push('One uppercase letter');
    if (password && !/[a-z]/.test(password)) errors.push('One lowercase letter');
    if (password && !/[0-9]/.test(password)) errors.push('One number');
    return errors;
  }, [password]);

  const isFormValid = email && password && acceptTerms && !emailError && passwordErrors.length === 0;

  // Load stored attempts on mount
  useEffect(() => {
    const storedAttempts = localStorage.getItem('loginAttempts');
    const storedLockoutEnd = localStorage.getItem('lockoutEndTime');
    if (storedAttempts) {
      const attempts = JSON.parse(storedAttempts);
      setLoginAttempts(attempts.count);
      setIsLocked(attempts.isLocked);
      if (storedLockoutEnd) {
        const endTime = parseInt(storedLockoutEnd);
        setLockoutEndTime(endTime);
        if (Date.now() < endTime) setIsLocked(true);
        else {
          setLoginAttempts(0);
          setIsLocked(false);
          setLockoutEndTime(null);
          localStorage.removeItem('loginAttempts');
          localStorage.removeItem('lockoutEndTime');
        }
      }
    }
  }, []);

  // Lockout timer
  useEffect(() => {
    if (isLocked && lockoutEndTime) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, lockoutEndTime - Date.now());
        setTimeRemaining(remaining);
        if (remaining <= 0) {
          setLoginAttempts(0);
          setIsLocked(false);
          setLockoutEndTime(null);
          localStorage.removeItem('loginAttempts');
          localStorage.removeItem('lockoutEndTime');
          clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isLocked, lockoutEndTime]);

  const handleFailedAttempt = () => {
    const newAttempts = loginAttempts + 1;
    setLoginAttempts(newAttempts);
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      const endTime = Date.now() + LOCKOUT_DURATION;
      setIsLocked(true);
      setLockoutEndTime(endTime);
      localStorage.setItem('lockoutEndTime', endTime.toString());
      localStorage.setItem('loginAttempts', JSON.stringify({ count: newAttempts, isLocked: true }));
      toast.error('Too many failed attempts. Account locked for 15 minutes.');
    } else {
      localStorage.setItem('loginAttempts', JSON.stringify({ count: newAttempts, isLocked: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      const remaining = Math.ceil(timeRemaining / 1000 / 60);
      setError(`Account is locked. Try again in ${remaining} minutes.`);
      return;
    }
    if (!isFormValid) return;

    setLoading(true);
    setError('');
    try {
      let recaptchaToken = null;
      if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
        recaptchaToken = await recaptchaRef.current?.executeAsync();
      }
      await signInWithEmail(email, password, recaptchaToken);
      // Clear attempts on success
      localStorage.removeItem('loginAttempts');
      localStorage.removeItem('lockoutEndTime');
      navigate('/');
    } catch (err: any) {
      handleFailedAttempt();
      setError(getSupabaseErrorMessage(err));
      if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
        recaptchaRef.current?.reset();
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0508] to-[#1a0f15] p-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl">
        <div className="flex justify-center mb-6">
          <Logo size="xl" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Welcome Back</h1>
        <p className="text-slate-400 mb-6 text-center">Sign in to continue to Epimetheus</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email field */}
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
                  setEmailError(sanitized && !isValidEmail(sanitized) ? 'Please enter a valid email address' : '');
                }}
                onBlur={() => {
                  if (email && !isValidEmail(email)) setEmailError('Please enter a valid email address');
                }}
                className={`w-full bg-white/5 border rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-primary/50 transition-all ${
                  emailError ? 'border-red-500/50' : 'border-white/10'
                }`}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            {emailError && <div className="text-xs text-red-400">{emailError}</div>}
          </div>

          {/* Password field with strength meter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-white/5 border rounded-xl py-3 pl-10 pr-10 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-primary/50 transition-all ${
                  password && passwordErrors.length === 0
                    ? 'border-green-500/50'
                    : 'border-white/10'
                }`}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {password && (
              <div className="space-y-2 mt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Strength:</span>
                  <span className={`font-medium text-${passwordStrength.color}-400`}>
                    {passwordStrength.strength}
                  </span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all bg-${passwordStrength.color}-500`}
                    style={{ width: passwordStrength.width }}
                  />
                </div>
                {passwordErrors.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {passwordErrors.map((err, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-red-400">
                        <div className="w-1 h-1 rounded-full bg-red-400" />
                        {err}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Terms checkbox */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="terms"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-1 rounded border-white/10 bg-white/5 text-accent-primary focus:ring-accent-primary"
              required
            />
            <label htmlFor="terms" className="text-sm text-slate-400 leading-relaxed">
              I agree to the{' '}
              <button type="button" className="text-accent-primary hover:underline">
                Terms of Service
              </button>{' '}
              and{' '}
              <button type="button" className="text-accent-primary hover:underline">
                Privacy Policy
              </button>
            </label>
          </div>

          {/* ReCAPTCHA - Graceful degradation if not configured */}
          {import.meta.env.VITE_RECAPTCHA_SITE_KEY ? (
            <div className="flex justify-center items-center w-full overflow-hidden">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                size="invisible"
                className="recaptcha-container"
              />
            </div>
          ) : null}

          {/* Attempts warning */}
          {loginAttempts > 0 && !isLocked && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
              <Fingerprint className="w-4 h-4" />
              <span>{MAX_LOGIN_ATTEMPTS - loginAttempts} attempts remaining</span>
            </div>
          )}

          {/* Lockout timer */}
          {isLocked && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <Clock className="w-4 h-4" />
              <span>Locked. Try again in {formatTime(timeRemaining)}</span>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !isFormValid || isLocked}
            className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-primary/90 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#1a0f15] text-slate-500">Or continue with</span>
              </div>
            </div>

            <button
              onClick={async () => {
                setLoading(true);
                setError('');
                try {
                  await signInWithGoogle();
                  navigate('/');
                } catch (err: any) {
                  setError(getSupabaseErrorMessage(err));
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="w-full mt-6 flex items-center justify-center gap-2 bg-white text-[#0a0508] font-bold py-3 rounded-xl hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Don't have an account?{' '}
          <button onClick={() => navigate('/register')} className="text-accent-primary hover:underline">
            Create one
          </button>
        </div>
      </div>
    </div>
  );
}
