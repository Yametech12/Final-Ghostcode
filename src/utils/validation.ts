/**
 * Input validation and sanitization utilities
 * Helps prevent XSS, injection attacks, and ensures data quality
 */

/**
 * Sanitizes user input to prevent XSS attacks
 * Removes or escapes potentially dangerous HTML/JavaScript
 */
export function sanitizeInput(input: string): string {
  if (!input) return input;

  return input
    // Remove HTML tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    // Remove common XSS patterns
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/expression\(/gi, '')
    // Decode HTML entities to prevent double encoding
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Trim whitespace
    .trim();
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;

  // Basic email regex pattern
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Validates email domain has valid MX records (basic check)
 */
export function hasValidEmailDomain(email: string): boolean {
  if (!isValidEmail(email)) return false;

  const domain = email.split('@')[1];
  if (!domain) return false;

  // Common disposable email patterns
  const disposablePatterns = [
    /.*\.tempmail\./i,
    /.*10minutemail\./i,
    /.*guerrillamail\./i,
    /.*mailinator\./i,
    /.*yopmail\./i,
  ];

  for (const pattern of disposablePatterns) {
    if (pattern.test(domain)) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if a string contains suspicious patterns
 */
export function containsSuspiciousPatterns(input: string): boolean {
  if (!input) return false;

  const suspiciousPatterns = [
    /(\w+)\s*=\s*['"][^'"]*['"]/, // attribute assignments
    /<iframe/i, // iframes
    /<object/i, // objects
    /<embed/i, // embeds
    /javascript:/i, // javascript protocol
    /data:/i, // data URIs
    /on\w+\s*=/i, // event handlers
    /eval\(/i, // eval calls
    /setTimeout\(/i, // setTimeout with string
    /document\.cookie/i, // cookie access
    /window\.location/i, // navigation
    /\.innerHTML/i, // innerHTML manipulation
    /\.outerHTML/i, // outerHTML manipulation
    /document\.write/i, // document.write
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}

/**
 * Validates username according to security requirements
 */
export function validateUsername(username: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!username) {
    errors.push('Username is required');
    return { isValid: false, errors };
  }

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters');
  }

  if (username.length > 30) {
    errors.push('Username must be less than 30 characters');
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, dots, hyphens, and underscores');
  }

  if (/^\d+$/.test(username)) {
    errors.push('Username cannot be entirely numeric');
  }

  if (containsSuspiciousPatterns(username)) {
    errors.push('Username contains invalid characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Enhanced password validation with security checks
 */
export function validatePasswordSecurity(password: string): {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
} {
  const errors: string[] = [];
  let strength: 'weak' | 'medium' | 'strong' | 'very-strong' = 'weak';

  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors, strength };
  }

  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  // Complexity checks
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumber) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecial) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common patterns
  const commonPatterns = [
    '123456', 'password', 'qwerty', 'abc123',
    'letmein', 'monkey', 'password1', 'admin'
  ];

  const lowerPassword = password.toLowerCase();
  if (commonPatterns.some(pattern => lowerPassword.includes(pattern))) {
    errors.push('Password contains a common weak pattern');
  }

  // Check if password is too similar to common words
  if (password.length > 0 && password.length < 20) {
    const repeatedChars = /(.)\1{2,}/.test(password);
    if (repeatedChars) {
      errors.push('Password contains too many repeated characters');
    }
  }

  // Calculate strength if no basic errors
  if (errors.length === 0 || errors.filter(e => e.startsWith('Password must be at least')).length > 0) {
    let score = 0;

    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    if (hasUppercase) score += 1;
    if (hasLowercase) score += 1;
    if (hasNumber) score += 1;
    if (hasSpecial) score += 1;

    // Deduct for patterns
    if (commonPatterns.some(pattern => lowerPassword.includes(pattern))) score -= 2;
    if (/(.)\1{3,}/.test(password)) score -= 1;

    score = Math.max(0, score);

    if (score >= 6) strength = 'very-strong';
    else if (score >= 4) strength = 'strong';
    else if (score >= 2) strength = 'medium';
    else strength = 'weak';
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength
  };
}

/**
 * Rate limiting helper - tracks attempts per key (e.g., IP, email)
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxAttempts: number;

  constructor(windowMs: number = 15 * 60 * 1000, maxAttempts: number = 5) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
  }

  /**
   * Check if a key is currently rate limited
   */
  isLimited(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Filter out attempts older than the window
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);

    return recentAttempts.length >= this.maxAttempts;
  }

  /**
   * Record an attempt for a key
   */
  recordAttempt(key: string): void {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    attempts.push(now);
    this.attempts.set(key, attempts);
  }

  /**
   * Get remaining attempts before lockout
   */
  getRemainingAttempts(key: string): number {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxAttempts - recentAttempts.length);
  }

  /**
   * Get time remaining until lockout expires (in milliseconds)
   */
  getTimeRemaining(key: string): number {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);

    if (recentAttempts.length < this.maxAttempts) return 0;

    const oldestAttempt = Math.min(...recentAttempts);
    return Math.max(0, oldestAttempt + this.windowMs - now);
  }

  /**
   * Reset attempts for a key
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.attempts.clear();
  }
}

/**
 * Input validation for form fields
 */
export const formValidators = {
  email: (email: string): { isValid: boolean; message: string } => {
    if (!email) {
      return { isValid: false, message: 'Email is required' };
    }
    if (!isValidEmail(email)) {
      return { isValid: false, message: 'Please enter a valid email address' };
    }
    if (!hasValidEmailDomain(email)) {
      return { isValid: false, message: 'Please use a permanent email address' };
    }
    return { isValid: true, message: '' };
  },

  password: (password: string): { isValid: boolean; errors: string[] } => {
    return validatePasswordSecurity(password);
  },

  username: (username: string): { isValid: boolean; errors: string[] } => {
    return validateUsername(username);
  },

  required: (value: string, fieldName: string): { isValid: boolean; message: string } => {
    if (!value || !value.trim()) {
      return { isValid: false, message: `${fieldName} is required` };
    }
    return { isValid: true, message: '' };
  },

  noSuspiciousContent: (value: string): { isValid: boolean; message: string } => {
    if (containsSuspiciousPatterns(value)) {
      return { isValid: false, message: 'Input contains invalid characters' };
    }
    return { isValid: true, message: '' };
  }
};
