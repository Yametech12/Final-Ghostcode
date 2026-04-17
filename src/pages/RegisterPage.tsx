import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, User, Eye, EyeOff, CheckCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseErrorMessage } from '../utils/errorHandling';

const getAuthErrorMessage = (error: any) => {
  const errorCode = error.code || (error.message && error.message.match(/auth\/[a-z-]+/)?.[0]);

  switch (errorCode) {
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please try signing in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/too-many-requests':
      return 'Too many requests. Please try again later.';
    case 'auth/operation-not-allowed':
      return 'Email/password accounts are not enabled.';
    default:
      return 'An unknown authentication error occurred.';
  }
};

const validatePassword = (password: string) => {
  const errors = [];
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
  if (!/\d/.test(password)) errors.push('One number');
  if (!/[!@#$%^&*]/.test(password)) errors.push('One special character (!@#$%^&*)');
  return errors;
};

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const navigate = useNavigate();
  const auth = useAuth();
  if (!auth) return <div>Loading...</div>;
  const { signUpWithEmail, signInWithGoogle } = auth;

  // Check if user just verified their email
  useEffect(() => {
    const verified = searchParams.get('verified');
    if (verified === 'true') {
      toast.success('Email verified successfully! You can now sign in.');
      navigate('/login');
    }
  }, [searchParams, navigate]);

  const passwordErrors = password ? validatePassword(password) : [];
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isFormValid = email && password && confirmPassword && name &&
                     passwordsMatch && passwordErrors.length === 0 && acceptTerms;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setError('');

    try {
      const result = await signUpWithEmail(email, password, name);

      if (result.requiresVerification) {
        setVerificationSent(true);
        toast.success('Account created! Please check your email to verify your account.');
      } else {
        toast.success('Account created successfully!');
        navigate('/login');
      }
    } catch (err: any) {
      const message = getSupabaseErrorMessage(err);
      setError(message);
      toast.error(message);
      console.error("Registration Error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-mystic-950">
        <div className="w-full max-w-md bg-mystic-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-4">Check Your Email</h1>
          <p className="text-slate-400 mb-6 leading-relaxed">
            We've sent a verification link to <strong className="text-white">{email}</strong>.
            Please check your email and click the verification link to activate your account.
          </p>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2 text-blue-400 text-sm">
                  <Mail className="w-4 h-4" />
                  <span>Check your spam/junk folder if you don't see the email</span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                  <Shield className="w-4 h-4" />
                  <span>Email verification helps keep your account secure</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => navigate('/login')}
                className="flex-1 bg-accent-primary hover:bg-accent-primary/90 text-white font-bold py-3 rounded-xl transition-all"
              >
                Go to Sign In
              </button>
              <button
                onClick={() => setVerificationSent(false)}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-mystic-950">
      <div className="w-full max-w-md bg-mystic-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-primary/20 flex items-center justify-center">
            <Shield className="w-8 h-8 text-accent-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-slate-400">Join Epimetheus with email verification</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-primary/50 transition-all"
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-primary/50 transition-all"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-white/5 border rounded-xl py-3 pl-10 pr-10 text-white placeholder:text-slate-500 focus:outline-none transition-all ${
                  password && passwordErrors.length > 0
                    ? 'border-red-500/50 focus:border-red-500/50'
                    : password && passwordErrors.length === 0
                    ? 'border-green-500/50 focus:border-green-500/50'
                    : 'border-white/10 focus:border-accent-primary/50'
                }`}
                placeholder="••••••••"
                autoComplete="new-password"
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
            {password && passwordErrors.length > 0 && (
              <div className="space-y-1">
                {passwordErrors.map((error, index) => (
                  <div key={index} className="flex items-center gap-1 text-xs text-red-400">
                    <div className="w-1 h-1 rounded-full bg-red-400" />
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full bg-white/5 border rounded-xl py-3 pl-10 pr-10 text-white placeholder:text-slate-500 focus:outline-none transition-all ${
                  confirmPassword && !passwordsMatch
                    ? 'border-red-500/50 focus:border-red-500/50'
                    : confirmPassword && passwordsMatch
                    ? 'border-green-500/50 focus:border-green-500/50'
                    : 'border-white/10 focus:border-accent-primary/50'
                }`}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <div className="text-xs text-red-400">Passwords do not match</div>
            )}
          </div>

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
              </button>
              {' '}and{' '}
              <button type="button" className="text-accent-primary hover:underline">
                Privacy Policy
              </button>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-primary/90 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} className="text-accent-primary font-bold hover:underline">
            Sign In
          </button>
        </div>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-mystic-900/50 text-slate-500">Or continue with</span>
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
                console.error("Google Sign-In Error:", err);
    const message = getAuthErrorMessage(err);
                setError(message);
                toast.error(message);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full mt-6 flex items-center justify-center gap-2 bg-white text-mystic-950 font-bold py-3 rounded-xl hover:bg-slate-100 transition-all disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign up with Google
          </button>
        </div>
      </div>
    </div>
  );
}