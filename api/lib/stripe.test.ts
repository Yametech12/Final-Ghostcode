/**
 * Stripe billing tests — the Stripe SDK is mocked; no network calls.
 *
 * Covers:
 *  • webhook signature verification (valid / invalid / missing / unconfigured)
 *  • idempotency ledger (duplicate ack, record failure, claim release on error)
 *  • tier transitions (checkout upgrade, reconcile, cancel → free, dunning grace)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const stripeMockState = vi.hoisted(() => ({
  constructEventAsync: undefined as
    | ((...args: unknown[]) => Promise<unknown>)
    | undefined,
}));

vi.mock('stripe', () => {
  class Stripe {
    webhooks = {
      constructEventAsync: (...args: unknown[]) =>
        stripeMockState.constructEventAsync!(...args),
    };
  }
  return { default: Stripe };
});

import {
  verifyStripeSignature,
  tierFromPriceId,
  __resetStripeForTests,
} from './stripe';
import { handleStripeWebhook } from './subscription';

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------
const ENV_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_STRATEGIST',
  'STRIPE_PRICE_ORACLE',
] as const;

beforeEach(() => {
  __resetStripeForTests();
  process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_abc123';
  process.env.STRIPE_PRICE_STRATEGIST = 'price_strategist';
  process.env.STRIPE_PRICE_ORACLE = 'price_oracle';
  stripeMockState.constructEventAsync = vi.fn();
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Supabase double
// ---------------------------------------------------------------------------
interface SupabaseCfg {
  /** stripe_events insert → maybeSingle result ('claimed' in cfg distinguishes an explicit null). */
  claimed?: unknown;
  claimedError?: unknown;
  /** users select → maybeSingle result. */
  userRow?: unknown;
  /** users update (thenable) error. */
  updateError?: unknown;
}

function makeSupabase(cfg: SupabaseCfg = {}) {
  const usersUpdates: Record<string, unknown>[] = [];
  const eqCalls: { table: string; args: unknown[] }[] = [];

  const makeBuilder = (table: string) => {
    const anyB: any = {};
    anyB.insert = vi.fn(() => anyB);
    anyB.upsert = vi.fn(() => anyB);
    anyB.select = vi.fn(() => anyB);
    anyB.update = vi.fn((payload: Record<string, unknown>) => {
      if (table === 'users') usersUpdates.push(payload);
      return anyB;
    });
    anyB.eq = vi.fn((...args: unknown[]) => {
      eqCalls.push({ table, args });
      return anyB;
    });
    anyB.delete = vi.fn(() => anyB);
    anyB.maybeSingle = vi.fn(async () => {
      if (table === 'stripe_events') {
        return {
          data: 'claimed' in cfg ? cfg.claimed : { id: 'evt_test_1' },
          error: cfg.claimedError ?? null,
        };
      }
      return { data: cfg.userRow ?? null, error: null };
    });
    anyB.single = vi.fn(async () => ({ data: null, error: null }));
    anyB.then = (
      resolve: (v: unknown) => unknown,
      reject: (e: unknown) => unknown,
    ) =>
      Promise.resolve({
        data: null,
        error: table === 'users' ? cfg.updateError ?? null : null,
      }).then(resolve, reject);
    return anyB;
  };

  const supabase = { from: vi.fn((table: string) => makeBuilder(table)) };
  return { supabase: supabase as any, usersUpdates, eqCalls };
}

function makeEvent(type: string, object: unknown): any {
  return {
    id: 'evt_test_1',
    type,
    data: { object },
    created: 0,
    livemode: false,
    object: 'event',
    pending_webhooks: 0,
    request: null,
    api_version: '2024-06-20',
  };
}

function checkoutSession(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'cs_123',
    payment_status: 'paid',
    customer: 'cus_123',
    client_reference_id: 'u1',
    subscription: 'sub_123',
    metadata: { userId: 'u1', tier: 'strategist' },
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------
describe('verifyStripeSignature', () => {
  it('returns the event for a valid signature', async () => {
    const event = makeEvent('checkout.session.completed', {});
    stripeMockState.constructEventAsync = vi.fn().mockResolvedValue(event);

    const res = await verifyStripeSignature('{"x":1}', 't=1,v1=sig');
    expect(res).toEqual(event);
    expect(stripeMockState.constructEventAsync).toHaveBeenCalledWith(
      '{"x":1}',
      't=1,v1=sig',
      'whsec_abc123',
    );
  });

  it('returns null on an invalid signature', async () => {
    stripeMockState.constructEventAsync = vi
      .fn()
      .mockRejectedValue(new Error('No signatures found matching the expected signature'));
    expect(await verifyStripeSignature('payload', 't=1,v1=bad')).toBeNull();
  });

  it('returns null when the signature header is missing', async () => {
    expect(await verifyStripeSignature('payload', undefined)).toBeNull();
  });

  it('returns null when the raw payload is missing', async () => {
    expect(await verifyStripeSignature(undefined, 't=1,v1=sig')).toBeNull();
  });

  it('returns null when billing is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    __resetStripeForTests();
    expect(await verifyStripeSignature('payload', 't=1,v1=sig')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Price → tier mapping
// ---------------------------------------------------------------------------
describe('tierFromPriceId', () => {
  it('maps the strategist price id', () => {
    expect(tierFromPriceId('price_strategist')).toBe('strategist');
  });
  it('maps the oracle price id', () => {
    expect(tierFromPriceId('price_oracle')).toBe('oracle');
  });
  it('returns null for unknown prices', () => {
    expect(tierFromPriceId('price_unknown')).toBeNull();
  });
  it('returns null for missing prices', () => {
    expect(tierFromPriceId(null)).toBeNull();
    expect(tierFromPriceId(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------
describe('handleStripeWebhook', () => {
  it('rejects deliveries whose signature fails verification with 400', async () => {
    stripeMockState.constructEventAsync = vi.fn().mockResolvedValue(null);
    const { supabase, usersUpdates } = makeSupabase();

    const r = await handleStripeWebhook('payload', 'bad-sig', supabase);

    expect(r.status).toBe(400);
    expect((r.body as any).code).toBe('SIGNATURE_VERIFICATION_FAILED');
    expect(usersUpdates).toHaveLength(0);
  });

  it('acks duplicate deliveries without reprocessing (idempotency)', async () => {
    stripeMockState.constructEventAsync = vi
      .fn()
      .mockResolvedValue(makeEvent('checkout.session.completed', checkoutSession()));
    const { supabase, usersUpdates } = makeSupabase({ claimed: null });

    const r = await handleStripeWebhook('payload', 'sig', supabase);

    expect(r.status).toBe(200);
    expect((r.body as any).duplicate).toBe(true);
    expect(usersUpdates).toHaveLength(0);
  });

  it('returns 500 when the event cannot be recorded', async () => {
    stripeMockState.constructEventAsync = vi
      .fn()
      .mockResolvedValue(makeEvent('checkout.session.completed', checkoutSession()));
    const { supabase, usersUpdates } = makeSupabase({ claimedError: { message: 'db down' } });

    const r = await handleStripeWebhook('payload', 'sig', supabase);

    expect(r.status).toBe(500);
    expect((r.body as any).code).toBe('EVENT_RECORD_FAILED');
    expect(usersUpdates).toHaveLength(0);
  });

  it('checkout.session.completed (paid) upgrades the tier', async () => {
    stripeMockState.constructEventAsync = vi
      .fn()
      .mockResolvedValue(makeEvent('checkout.session.completed', checkoutSession()));
    const { supabase, usersUpdates } = makeSupabase();

    const r = await handleStripeWebhook('payload', 'sig', supabase);

    expect(r.status).toBe(200);
    expect(usersUpdates).toHaveLength(1);
    expect(usersUpdates[0]).toMatchObject({
      subscription_tier: 'strategist',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
      billing_grace_period_until: null,
    });
    // 1-month initial expiry until the first reconcile pins the real period end.
    expect(typeof usersUpdates[0].subscription_expires_at).toBe('string');
  });

  it('ignores unpaid checkout sessions', async () => {
    stripeMockState.constructEventAsync = vi
      .fn()
      .mockResolvedValue(
        makeEvent('checkout.session.completed', checkoutSession({ payment_status: 'unpaid' })),
      );
    const { supabase, usersUpdates } = makeSupabase();

    const r = await handleStripeWebhook('payload', 'sig', supabase);

    expect(r.status).toBe(200);
    expect((r.body as any).ignored).toContain('payment_status');
    expect(usersUpdates).toHaveLength(0);
  });

  it('customer.subscription.updated reconciles tier and expiry', async () => {
    stripeMockState.constructEventAsync = vi.fn().mockResolvedValue(
      makeEvent('customer.subscription.updated', {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        metadata: {},
        items: { data: [{ price: { id: 'price_strategist' }, current_period_end: 1_800_000_000 }] },
      }),
    );
    const { supabase, usersUpdates } = makeSupabase({ userRow: { id: 'u1' } });

    const r = await handleStripeWebhook('payload', 'sig', supabase);

    expect(r.status).toBe(200);
    expect(usersUpdates).toHaveLength(1);
    expect(usersUpdates[0].subscription_tier).toBe('strategist');
    expect(usersUpdates[0].subscription_expires_at).toBe(
      new Date(1_800_000_000 * 1000).toISOString(),
    );
    expect(usersUpdates[0].billing_grace_period_until).toBeNull();
  });

  it('customer.subscription.updated with an unknown price never guesses the tier', async () => {
    stripeMockState.constructEventAsync = vi.fn().mockResolvedValue(
      makeEvent('customer.subscription.updated', {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        metadata: {},
        items: { data: [{ price: { id: 'price_unknown' } }] },
      }),
    );
    const { supabase, usersUpdates } = makeSupabase({ userRow: { id: 'u1' } });

    const r = await handleStripeWebhook('payload', 'sig', supabase);

    expect(r.status).toBe(200);
    expect((r.body as any).ignored).toBe('unknown price');
    expect(usersUpdates).toHaveLength(0);
  });

  it('customer.subscription.deleted downgrades to free', async () => {
    stripeMockState.constructEventAsync = vi.fn().mockResolvedValue(
      makeEvent('customer.subscription.deleted', {
        id: 'sub_123',
        customer: 'cus_123',
        metadata: {},
      }),
    );
    const { supabase, usersUpdates } = makeSupabase({ userRow: { id: 'u1' } });

    const r = await handleStripeWebhook('payload', 'sig', supabase);

    expect(r.status).toBe(200);
    expect(usersUpdates).toHaveLength(1);
    expect(usersUpdates[0]).toMatchObject({
      subscription_tier: 'free',
      subscription_expires_at: null,
      billing_grace_period_until: null,
    });
  });

  it('invoice.payment_failed grants a grace period WITHOUT downgrading', async () => {
    stripeMockState.constructEventAsync = vi.fn().mockResolvedValue(
      makeEvent('invoice.payment_failed', {
        id: 'in_123',
        customer: 'cus_123',
        subscription: 'sub_123',
      }),
    );
    const { supabase, usersUpdates } = makeSupabase({ userRow: { id: 'u1' } });

    const r = await handleStripeWebhook('payload', 'sig', supabase);

    expect(r.status).toBe(200);
    expect(usersUpdates).toHaveLength(1);
    expect(typeof usersUpdates[0].billing_grace_period_until).toBe('string');
    expect(usersUpdates[0]).not.toHaveProperty('subscription_tier');
  });

  it('releases the idempotency claim when processing fails (Stripe retry can re-deliver)', async () => {
    stripeMockState.constructEventAsync = vi
      .fn()
      .mockResolvedValue(makeEvent('checkout.session.completed', checkoutSession()));
    const { supabase, eqCalls } = makeSupabase({ updateError: { message: 'update failed' } });

    const r = await handleStripeWebhook('payload', 'sig', supabase);

    expect(r.status).toBe(500);
    expect((r.body as any).code).toBe('EVENT_PROCESS_FAILED');
    expect(eqCalls).toContainEqual({ table: 'stripe_events', args: ['id', 'evt_test_1'] });
  });

  it('acks and ignores unrelated event types', async () => {
    stripeMockState.constructEventAsync = vi
      .fn()
      .mockResolvedValue(makeEvent('invoice.paid', { id: 'in_1' }));
    const { supabase, usersUpdates } = makeSupabase();

    const r = await handleStripeWebhook('payload', 'sig', supabase);

    expect(r.status).toBe(200);
    expect((r.body as any).ignored).toBe('invoice.paid');
    expect(usersUpdates).toHaveLength(0);
  });
});
