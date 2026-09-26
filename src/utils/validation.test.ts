import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sanitizeInput,
  isUUID,
  isValidEmail,
  hasValidEmailDomain,
  containsSuspiciousPatterns,
  validateUsername,
  validatePasswordSecurity,
  RateLimiter,
} from './validation';

describe('sanitizeInput', () => {
  // The old regex "sanitizers" (tag stripping + entity encoding) were removed:
  // they were bypassable and mangled valid input. New contract: normalize only.
  it('trims and passes valid text through unchanged', () => {
    expect(sanitizeInput('  hello world  ')).toBe('hello world');
  });

  it('preserves emails containing &, quotes or apostrophes (M-04 regression)', () => {
    const email = "o'brien&co+tag@example.com";
    expect(sanitizeInput(email)).toBe(email);
  });

  it('no longer encodes HTML metacharacters (escape-at-render handles that)', () => {
    expect(sanitizeInput('a & b')).toBe('a & b');
  });

  it('strips control characters', () => {
    expect(sanitizeInput('a\u0000b\u0007c')).toBe('abc');
  });

  it('returns input untouched when falsy', () => {
    expect(sanitizeInput('')).toBe('');
  });
});

describe('isUUID', () => {
  it('accepts a valid v4 UUID', () => {
    expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('accepts an upper-case UUID', () => {
    expect(isUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('rejects empty / nonsense strings', () => {
    expect(isUUID('')).toBe(false);
    expect(isUUID('not-a-uuid')).toBe(false);
    expect(isUUID('550e8400-e29b-41d4-a716-44665544000')).toBe(false); // short
  });

  it('rejects v6+ version nibble (regex enforces [1-5])', () => {
    expect(isUUID('550e8400-e29b-61d4-a716-446655440000')).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('accepts a typical email', () => {
    expect(isValidEmail('alice@example.com')).toBe(true);
  });

  it('rejects empty', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('rejects missing @', () => {
    expect(isValidEmail('aliceexample.com')).toBe(false);
  });

  it('rejects missing TLD', () => {
    expect(isValidEmail('alice@example')).toBe(false);
  });
});

describe('hasValidEmailDomain', () => {
  it('rejects known disposable domains', () => {
    expect(hasValidEmailDomain('a@mailinator.com')).toBe(false);
    expect(hasValidEmailDomain('b@yopmail.com')).toBe(false);
  });

  it('accepts common providers', () => {
    expect(hasValidEmailDomain('a@gmail.com')).toBe(true);
  });
});

describe('containsSuspiciousPatterns', () => {
  it('flags iframes, event handlers, and eval', () => {
    expect(containsSuspiciousPatterns('<iframe src=x>')).toBe(true);
    expect(containsSuspiciousPatterns('onclick="boom"')).toBe(true);
    expect(containsSuspiciousPatterns('eval(...)')).toBe(true);
  });

  it('does not flag ordinary prose', () => {
    expect(containsSuspiciousPatterns('the quick brown fox')).toBe(false);
  });
});

describe('validateUsername', () => {
  it('rejects empty', () => {
    expect(validateUsername('').isValid).toBe(false);
  });

  it('rejects too-short', () => {
    expect(validateUsername('ab').isValid).toBe(false);
  });

  it('rejects entirely numeric', () => {
    expect(validateUsername('1234').isValid).toBe(false);
  });

  it('accepts a normal username', () => {
    expect(validateUsername('alice_42').isValid).toBe(true);
  });

  it('rejects characters outside the allow-list', () => {
    expect(validateUsername('alice!').isValid).toBe(false);
  });
});

describe('validatePasswordSecurity', () => {
  it('rejects empty as weak/invalid', () => {
    const r = validatePasswordSecurity('');
    expect(r.isValid).toBe(false);
    expect(r.strength).toBe('weak');
  });

  it('rejects a short password', () => {
    expect(validatePasswordSecurity('Ab1!').isValid).toBe(false);
  });

  it('rejects a password missing a character class', () => {
    // No uppercase
    expect(validatePasswordSecurity('alllower1!').isValid).toBe(false);
  });

  it('flags known weak patterns', () => {
    const r = validatePasswordSecurity('Password123!');
    expect(r.errors.some(e => /weak pattern/i.test(e))).toBe(true);
  });

  it('accepts a strong password with a special character', () => {
    // Regression test for the previous broken regex which closed the character
    // class early at `]` and never matched any special character. After the
    // fix at src/utils/validation.ts, a password meeting all rules should
    // return isValid=true and report a strong/very-strong strength.
    const r = validatePasswordSecurity('Northwind!Sky9-Run');
    expect(r.isValid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(['strong', 'very-strong']).toContain(r.strength);
  });

  it('still rejects a password with no special character', () => {
    const r = validatePasswordSecurity('Northwind1Sky9Run');
    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => /special character/i.test(e))).toBe(true);
  });
});

describe('RateLimiter', () => {
  beforeEach(() => {
    // Use fake timers so we can advance through the window deterministically
    // without actually sleeping in the test.
    vi.useFakeTimers();
  });

  it('flips to limited on the maxAttempts-th attempt', () => {
    const rl = new RateLimiter(60_000, 3);
    expect(rl.isLimited('k')).toBe(false);

    rl.recordAttempt('k');
    expect(rl.getRemainingAttempts('k')).toBe(2);
    expect(rl.isLimited('k')).toBe(false);

    rl.recordAttempt('k');
    expect(rl.getRemainingAttempts('k')).toBe(1);
    expect(rl.isLimited('k')).toBe(false);

    rl.recordAttempt('k');
    expect(rl.getRemainingAttempts('k')).toBe(0);
    expect(rl.isLimited('k')).toBe(true);
  });

  it('expires the window after windowMs', () => {
    const rl = new RateLimiter(60_000, 2);
    rl.recordAttempt('k');
    rl.recordAttempt('k');
    expect(rl.isLimited('k')).toBe(true);

    // Move clock past the window
    vi.advanceTimersByTime(60_001);
    expect(rl.isLimited('k')).toBe(false);
  });

  it('reset and clear wipe the counters', () => {
    const rl = new RateLimiter(60_000, 1);
    rl.recordAttempt('k');
    expect(rl.isLimited('k')).toBe(true);
    rl.reset('k');
    expect(rl.isLimited('k')).toBe(false);

    rl.recordAttempt('a');
    rl.recordAttempt('b');
    rl.clear();
    expect(rl.isLimited('a')).toBe(false);
    expect(rl.isLimited('b')).toBe(false);
  });
});
