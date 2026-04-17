#!/usr/bin/env python3
import re

with open(r'C:\Users\JoeRomano\Desktop\ghostnamee\Final-Ghostcode\src\pages\LoginPage.tsx', 'r') as f:
    content = f.read()

# 1. Add imports
content = content.replace(
    'import { Mail, Lock, ArrowRight, Loader2, AlertCircle, User, Eye, EyeOff } from \'lucide-react\';',
    'import { Mail, Lock, ArrowRight, Loader2, AlertCircle, User, Eye, EyeOff, Clock, Fingerprint } from \'lucide-react\';'
)

content = content.replace(
    'import { getSupabaseErrorMessage } from \'../utils/errorHandling\';',
    'import { getSupabaseErrorMessage, isValidEmail } from \'../utils/errorHandling\';\nimport { sanitizeInput } from \'../utils/validation\';'
)

# 2. Add security constants after imports
content = content.replace(
    'export default function LoginPage() {',
    '''// Rate limiting and security constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes window

export default function LoginPage() {'''
)

# 3. Add state variables
content = content.replace(
    "  const [error, setError] = useState('');\n  const navigate = useNavigate();",
    '''  const [error, setError] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const recaptchaRef = React.useRef(null);

  // Load stored login attempts
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
        if (Date.now() < endTime) {
          setIsLocked(true);
        } else {
          // Lockout expired
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
  };'''
)

# 4. Update handleSubmit to check lockout and use recaptcha
content = content.replace(
    '  const handleSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    setLoading(true);\n    setError(\''');
    '  const handleSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n\n    if (isLocked) {\n      const remaining = Math.ceil(timeRemaining / 1000 / 60);\n      setError(`Account is locked. Try again in ${remaining} minutes.`);\n      return;\n    }\n\n    setLoading(true);\n    setError(\''');

# 5. Update the try-catch to use recaptcha
content = content.replace(
    "      await signInWithEmail(email, password);\n      navigate('/');",
    "      await signInWithEmail(email, password, recaptchaToken);\n      navigate('/');"
)

# 6. Add error display after error div
content = content.replace(
    '''            </div>
          )}


          <div className="space-y-2">''',
    '''            </div>
          )}

          {loginAttempts > 0 && !isLocked && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
              <Fingerprint className="w-4 h-4" />
              <span>{MAX_LOGIN_ATTEMPTS - loginAttempts} attempts remaining before account lockout.</span>
            </div>
          )}


          <div className="space-y-2">'''
)

# 7. Update Email input to include validation
content = content.replace(
    '''              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-accent-primary/50 transition-all"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />''',
    '''              <input
                type="email"
                value={email}
                onChange={(e) => {
                  const sanitized = sanitizeInput(e.target.value);
                  setEmail(sanitized);
                  if (sanitized && !isValidEmail(sanitized)) {
                    setEmailError('Please enter a valid email address');
                  } else {
                    setEmailError('');
                  }
                }}
                onBlur={() => {
                  if (email && !isValidEmail(email)) {
                    setEmailError('Please enter a valid email address');
                  }
                }}
                className={`w-full bg-white/5 border rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-primary/50 transition-all ${
                  emailError ? 'border-red-500/50' : 'border-white/10'
                }`}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />'''
)

# 8. Add email error display
content = content.replace(
    '''            </div>
          </div>

          <div className="space-y-2">''',
    '''            </div>
            {emailError && (
              <div className="mt-1 text-xs text-red-400">{emailError}</div>
            )}
          </div>

          <div className="space-y-2">'''
)

# 9. Add password strength meter and validation
content = content.replace(
    '''            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-10 text-white focus:outline-none focus:border-accent-primary/50 transition-all"
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
            </div>


          <div className="mt-6 text-center text-sm text-slate-400">''',
    '''            <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full bg-white/5 border rounded-xl py-3 pl-10 pr-10 text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-primary/50 transition-all ${
                    passwordError
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
              {passwordError && (
                <div className="text-xs text-red-400 mt-1">{passwordError}</div>
              )}
              {password && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Password Strength:</span>
                      <span className={`font-medium ${
                        passwordStrength.color === 'green' ? 'text-green-400' :
                        passwordStrength.color === 'blue' ? 'text-blue-400' :
                        passwordStrength.color === 'yellow' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {passwordStrength.strength}
                      </span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          passwordStrength.color === 'green' ? 'bg-green-500' :
                          passwordStrength.color === 'blue' ? 'bg-blue-500' :
                          passwordStrength.color === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: passwordStrength.width }}
                      />
                    </div>
                  </div>

                  {passwordErrors.length > 0 && (
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
              )}
            </div>
          </div>

          <div className="space-y-2">'''
)

# 10. Add checkbox and terms with proper structure
content = content.replace(
    '''              <input
                type="checkbox"
                id="terms"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-white/10 bg-white/5 text-accent-primary focus:ring-accent-primary"
              />
              <label htmlFor="terms" className="text-sm text-slate-400 cursor-pointer">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-primary/90 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >''',
    '''              <div className="flex items-start gap-3">
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

          {/* ReCAPTCHA */}
          <div className="flex justify-center">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-'}
              onChange={(token: string | null) => setRecaptchaToken(token)}
              onExpired={() => setRecaptchaToken(null)}
              hl="en"
            />
          </div>

          <button
              type="submit"
              disabled={loading || !isFormValid}
              className="w-full flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-primary/90 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >'''
)

# 11. Add form validation and ReCAPTCHA
content = content.replace(
    '                disabled={loading}\n              >',
    '                disabled={loading || !isFormValid}\n              >'
)

# Add form validity check before submit
content = content.replace(
    "    const handleSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n\n    setLoading(true);\n    setError('');",
    "    const handleSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n\n    if (!isFormValid) return;\n\n    setLoading(true);\n    setError('');"
)

# Write the new content
with open(r'C:\Users\JoeRomano\Desktop\ghostnamee\Final-Ghostcode\src\pages\LoginPage.tsx', 'w') as f:
    f.write(content)

print("LoginPage.tsx updated successfully")
