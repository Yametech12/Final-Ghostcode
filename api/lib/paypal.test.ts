import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isValidPlanKey,
  planKeyToTier,
  planIdToTier,
  planIdToPlanKey,
  paypalApiBase,
  isPayPalConfigured,
  resolveWebhookAction,
  type PlanKey,
} from './paypal';

/**
 * Unit tests for the PayPal Subscriptions integration's pure logic:
 * plan/tier mapping, webhook event resolution, and configuration checks.
 * Network calls (PayPal REST) are not exercised here.
 */

describe('plan keys', () => {
  it('accepts the four known plan keys', () => {
    const keys: PlanKey[] = [
      'strategist-monthly',
      'strategist-annual',
      'oracle-monthly',
      'oracle-annual',
    ];
    for (const k of keys) expect(isValidPlanKey(k)).toBe(true);
  });

  it('rejects unknown, empty, and non-string keys', () => {
    expect(isValidPlanKey('strategist')).toBe(false);
    expect(isValidPlanKey('')).toBe(false);
    expect(isValidPlanKey(undefined)).toBe(false);
    expect(isValidPlanKey(null)).toBe(false);
    expect(isValidPlanKey(42)).toBe(false);
    expect(isValidPlanKey('ORACLE-MONTHLY')).toBe(false);
  });

  it('maps plan keys to tiers', () => {
    expect(planKeyToTier('strategist-monthly')).toBe('strategist');
    expect(planKeyToTier('strategist-annual')).toBe('strategist');
    expect(planKeyToTier('oracle-monthly')).toBe('oracle');
    expect(planKeyToTier('oracle-annual')).toBe('oracle');
  });
});

describe('paypalApiBase', () => {
  it('returns the live base for mode=live', () => {
    expect(paypalApiBase('live')).toBe('https://api-m.paypal.com');
  });

  it('defaults to sandbox for any other mode', () => {
    expect(paypalApiBase('sandbox')).toBe('https://api-m.sandbox.paypal.com');
    expect(paypalApiBase(undefined)).toBe('https://api-m.sandbox.paypal.com');
    expect(paypalApiBase('')).toBe('https://api-m.sandbox.paypal.com');
    expect(paypalApiBase('LIVE')).toBe('https://api-m.sandbox.paypal.com');
  });
});

describe('isPayPalConfigured', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.VITE_PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('is false when nothing is set', () => {
    expect(isPayPalConfigured()).toBe(false);
  });

  it('is false when only the client ID is set', () => {
    process.env.PAYPAL_CLIENT_ID = 'id';
    expect(isPayPalConfigured()).toBe(false);
  });

  it('is true with client ID and secret', () => {
    process.env.PAYPAL_CLIENT_ID = 'id';
    process.env.PAYPAL_CLIENT_SECRET = 'secret';
    expect(isPayPalConfigured()).toBe(true);
  });

  it('accepts the VITE_ client ID as fallback', () => {
    process.env.VITE_PAYPAL_CLIENT_ID = 'id';
    process.env.PAYPAL_CLIENT_SECRET = 'secret';
    expect(isPayPalConfigured()).toBe(true);
  });
});

describe('planIdToTier / planIdToPlanKey', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      PAYPAL_PLAN_STRATEGIST_MONTHLY: 'P-SM',
      PAYPAL_PLAN_STRATEGIST_ANNUAL: 'P-SA',
      PAYPAL_PLAN_ORACLE_MONTHLY: 'P-OM',
      PAYPAL_PLAN_ORACLE_ANNUAL: 'P-OA',
    };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('resolves each configured plan ID to its tier and key', () => {
    expect(planIdToTier('P-SM')).toBe('strategist');
    expect(planIdToTier('P-SA')).toBe('strategist');
    expect(planIdToTier('P-OM')).toBe('oracle');
    expect(planIdToTier('P-OA')).toBe('oracle');
    expect(planIdToPlanKey('P-OA')).toBe('oracle-annual');
    expect(planIdToPlanKey('P-SM')).toBe('strategist-monthly');
  });

  it('returns null for unknown or missing plan IDs', () => {
    expect(planIdToTier('P-UNKNOWN')).toBeNull();
    expect(planIdToTier(undefined)).toBeNull();
    expect(planIdToPlanKey('P-UNKNOWN')).toBeNull();
    expect(planIdToPlanKey(undefined)).toBeNull();
  });
});

describe('resolveWebhookAction', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      PAYPAL_PLAN_STRATEGIST_MONTHLY: 'P-SM',
      PAYPAL_PLAN_ORACLE_ANNUAL: 'P-OA',
    };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('activates the right tier on ACTIVATED / RE-ACTIVATED', () => {
    expect(resolveWebhookAction('BILLING.SUBSCRIPTION.ACTIVATED', 'P-SM')).toEqual({
      action: 'activate',
      tier: 'strategist',
    });
    expect(resolveWebhookAction('BILLING.SUBSCRIPTION.RE-ACTIVATED', 'P-OA')).toEqual({
      action: 'activate',
      tier: 'oracle',
    });
  });

  it('deactivates on CANCELLED, EXPIRED, and SUSPENDED', () => {
    for (const type of [
      'BILLING.SUBSCRIPTION.CANCELLED',
      'BILLING.SUBSCRIPTION.EXPIRED',
      'BILLING.SUBSCRIPTION.SUSPENDED',
    ]) {
      expect(resolveWebhookAction(type, 'P-SM')).toEqual({ action: 'deactivate' });
    }
  });

  it('ignores activation for an unknown plan ID', () => {
    expect(resolveWebhookAction('BILLING.SUBSCRIPTION.ACTIVATED', 'P-???')).toEqual({
      action: 'ignore',
    });
    expect(resolveWebhookAction('BILLING.SUBSCRIPTION.ACTIVATED', undefined)).toEqual({
      action: 'ignore',
    });
  });

  it('ignores unrelated event types', () => {
    expect(resolveWebhookAction('PAYMENT.SALE.COMPLETED', 'P-SM')).toEqual({ action: 'ignore' });
    expect(resolveWebhookAction('BILLING.SUBSCRIPTION.PAYMENT_FAILED', 'P-SM')).toEqual({
      action: 'ignore',
    });
    expect(resolveWebhookAction('', 'P-SM')).toEqual({ action: 'ignore' });
  });
});
