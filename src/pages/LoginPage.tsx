import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, Eye, EyeOff, Clock, Fingerprint } from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';
import { toast } from 'sonner';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { getSupabaseErrorMessage, isValidEmail } from '../utils/errorHandling';
import { sanitizeInput } from '../utils/validation';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export default function LoginPage() {
  const navigate = useNavigate();
  const { signInWithEmail } = useEnhancedAuth();
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
      recaptchaRef.current?.reset();
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
        <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
        <p className="text-slate-400 mb-6">Sign in to continue to Epimetheus</p>

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

          {/* ReCAPTCHA */}
          <div className="flex justify-center">
            {import.meta.env.VITE_RECAPTCHA_SITE_KEY ? (
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                size="invisible"
              />
            ) : (
              <div className="text-red-400 text-sm text-center">
                reCAPTCHA site key not configured. Please add VITE_RECAPTCHA_SITE_KEY to your .env file.
              </div>
            )}
          </div>

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