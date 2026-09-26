import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NormalizedRequest } from './handlers.js';

/**
 * Same Upstash boundary mock as cache.test.ts — duplicated rather than shared so
 * this file can control the client independently of the cache unit suite.
 */
const mocks = vi.hoisted(() => {
  interface Entry {
    value: unknown;
    expiresAt: number | null;
  }

  const state = {
    store: new Map<string, Entry>(),
    delCalls: [] as string[],
    fail: { get: false, set: false, del: false, incr: false, expire: false, ttl: false },
    reset() {
      state.store.clear();
      state.delCalls = [];
      state.fail = { get: false, set: false, del: false, incr: false, expire: false, ttl: false };
    },
  };

  function live(key: string): Entry | undefined {
    const entry = state.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      state.store.delete(key);
      return undefined;
    }
    return entry;
  }

  class Redis {
    async get(key: string): Promise<unknown> {
      if (state.fail.get) throw new Error('redis down: get');
      const entry = live(key);
      if (!entry) return null;
      return typeof entry.value === 'string' ? entry.value : null;
    }

    async set(key: string, value: string, options?: { ex?: number }): Promise<string> {
      if (state.fail.set) throw new Error('redis down: set');
      state.store.set(key, {
        value,
        expiresAt: options?.ex ? Date.now() + options.ex * 1000 : null,
      });
      return 'OK';
    }

    async del(key: string): Promise<number> {
      if (state.fail.del) throw new Error('redis down: del');
      state.delCalls.push(key);
      return state.store.delete(key) ? 1 : 0;
    }

    async incr(key: string): Promise<number> {
      if (state.fail.incr) throw new Error('redis down: incr');
      const entry = live(key);
      state.store.set(key, {
        value: String((entry ? Number(entry.value) : 0) + 1),
        expiresAt: entry?.expiresAt ?? null,
      });
      return Number(state.store.get(key)!.value);
    }

    async expire(key: string, sec: number): Promise<number> {
      if (state.fail.expire) throw new Error('redis down: expire');
      const entry = live(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + sec * 1000;
      return 1;
    }

    async ttl(key: string): Promise<number> {
      if (state.fail.ttl) throw new Error('redis down: ttl');
      const entry = live(key);
      if (!entry) return -2;
      if (entry.expiresAt === null) return -1;
      const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
      return remaining < 0 ? -2 : remaining;
    }
  }

  return { state, Redis };
});

vi.mock('@upstash/redis', () => ({ Redis: mocks.Redis }));

type TierGateModule = typeof import('./tierGate.js');

interface SupabaseDouble {
  client: unknown;
  selects: () => number;
  upserts: () => number;
}

/**
 * Minimal Supabase double. Only the chain `requireTier`/`getEffectiveTier` use
 * is implemented: .from().select().eq().maybeSingle() plus .upsert().
 */
function makeSupabase(
  row: Record<string, unknown> | null,
  options: { error?: unknown } = {},
): SupabaseDouble {
  let selects = 0;
  let upserts = 0;

  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => {
      selects += 1;
      if (options.error) return { data: null, error: options.error };
      return { data: row, error: null };
    },
    upsert: async () => {
      upserts += 1;
      return { error: null };
    },
  };

  return {
    client: { from: () => builder },
    selects: () => selects,
    upserts: () => upserts,
  };
}

function requestFor(id: string, email = `${id}@example.com`): NormalizedRequest {
  return {
    method: 'POST',
    body: {},
    query: {},
    params: {},
    headers: {},
    user: { id, email },
  } as unknown as NormalizedRequest;
}

const REDIS_ENV = {
  UPSTASH_REDIS_REST_URL: 'https://tier-test.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-token',
};

async function loadTierGate(env: Record<string, string>): Promise<TierGateModule> {
  vi.resetModules();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', env.UPSTASH_REDIS_REST_URL ?? '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', env.UPSTASH_REDIS_REST_TOKEN ?? '');
  return (await import('./tierGate.js')) as TierGateModule;
}

beforeEach(() => {
  mocks.state.reset();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('requireTier decision logic', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const gate = await loadTierGate(REDIS_ENV);
    const supabase = makeSupabase({ role: 'user', subscription_tier: 'oracle' });
    const req = { ...requestFor('u-auth'), user: undefined } as unknown as NormalizedRequest;

    const denied = await gate.requireTier(req, supabase.client as never, 'strategist');
    expect(denied?.status).toBe(401);
    expect(denied?.body.code).toBe('UNAUTHORIZED');
  });

  it('lets an admin through any gate', async () => {
    const gate = await loadTierGate(REDIS_ENV);
    const supabase = makeSupabase({
      role: 'admin',
      subscription_tier: 'free',
      subscription_expires_at: null,
    });

    const denied = await gate.requireTier(requestFor('u-admin'), supabase.client as never, 'oracle');
    expect(denied).toBeNull();
  });

  it('passes a strategist for strategist and blocks them at oracle', async () => {
    const gate = await loadTierGate(REDIS_ENV);
    const supabase = makeSupabase({
      role: 'user',
      subscription_tier: 'strategist',
      subscription_expires_at: null,
    });

    await expect(
      gate.requireTier(requestFor('u-strat'), supabase.client as never, 'strategist'),
    ).resolves.toBeNull();

    const denied = await gate.requireTier(requestFor('u-strat'), supabase.client as never, 'oracle');
    expect(denied?.status).toBe(402);
    expect(denied?.body).toMatchObject({
      code: 'PAYMENT_REQUIRED',
      requiredTier: 'oracle',
      currentTier: 'strategist',
    });
  });

  it('downgrades an expired subscription to free', async () => {
    const gate = await loadTierGate(REDIS_ENV);
    const supabase = makeSupabase({
      role: 'user',
      subscription_tier: 'oracle',
      subscription_expires_at: new Date(Date.now() - 60_000).toISOString(),
    });

    const denied = await gate.requireTier(requestFor('u-expired'), supabase.client as never, 'strategist');
    expect(denied?.status).toBe(402);
    expect(denied?.body.currentTier).toBe('free');
  });

  it('returns 503 when the Supabase lookup errors', async () => {
    const gate = await loadTierGate(REDIS_ENV);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = makeSupabase(null, { error: new Error('db down') });

    const denied = await gate.requireTier(requestFor('u-dberr'), supabase.client as never, 'strategist');
    expect(denied?.status).toBe(503);
    expect(denied?.body.code).toBe('SUBSCRIPTION_LOOKUP_FAILED');
  });

  it('does not poison the shared cache with a free verdict after a DB error', async () => {
    const gate = await loadTierGate(REDIS_ENV);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = makeSupabase(null, { error: new Error('db down') });

    await gate.requireTier(requestFor('u-nopoison'), broken.client as never, 'strategist');
    expect(mocks.state.store.has('tier:u-nopoison')).toBe(false);
  });
});

describe('tierGate caching through Redis', () => {
  it('writes the resolved entry to Redis under tier:<userId>', async () => {
    const gate = await loadTierGate(REDIS_ENV);
    const supabase = makeSupabase({
      role: 'user',
      subscription_tier: 'oracle',
      subscription_expires_at: null,
    });

    await gate.requireTier(requestFor('u-write'), supabase.client as never, 'strategist');

    const raw = mocks.state.store.get('tier:u-write');
    expect(raw).toBeDefined();
    const parsed = JSON.parse(String(raw!.value)) as { v: Record<string, unknown> };
    expect(parsed.v).toMatchObject({ role: 'user', tier: 'oracle' });
    expect(typeof parsed.v.expiresAt).toBe('number');
    // Redis TTL is 30s in seconds, not milliseconds.
    expect(raw!.expiresAt).toBeGreaterThan(Date.now());
    expect(raw!.expiresAt).toBeLessThanOrEqual(Date.now() + 30_500);
  });

  it('serves the second call from the process-local shadow cache without a DB read', async () => {
    const gate = await loadTierGate(REDIS_ENV);
    const supabase = makeSupabase({
      role: 'user',
      subscription_tier: 'oracle',
      subscription_expires_at: null,
    });

    await gate.requireTier(requestFor('u-shadow'), supabase.client as never, 'strategist');
    await gate.requireTier(requestFor('u-shadow'), supabase.client as never, 'strategist');

    expect(supabase.selects()).toBe(1);
  });

  it('reads from Redis when the shadow cache is cold, without touching the DB', async () => {
    const gate = await loadTierGate(REDIS_ENV);
    const supabase = makeSupabase({
      role: 'user',
      subscription_tier: 'oracle',
      subscription_expires_at: null,
    });

    await gate.requireTier(requestFor('u-redis'), supabase.client as never, 'strategist');
    expect(supabase.selects()).toBe(1);

    // Clears the shadow cache and the process-local tier keys — NOT Redis.
    gate.__resetTierCacheForTests();
    expect(mocks.state.store.has('tier:u-redis')).toBe(true);

    await gate.requireTier(requestFor('u-redis'), supabase.client as never, 'strategist');
    expect(supabase.selects()).toBe(1);
  });

  it('invalidates both cache tiers so the next call re-reads the DB', async () => {
    const gate = await loadTierGate(REDIS_ENV);
    const supabase = makeSupabase({
      role: 'user',
      subscription_tier: 'strategist',
      subscription_expires_at: null,
    });

    await gate.requireTier(requestFor('u-inval'), supabase.client as never, 'strategist');
    expect(supabase.selects()).toBe(1);

    await gate.invalidateTierCache('u-inval');
    expect(mocks.state.delCalls).toContain('tier:u-inval');
    expect(mocks.state.store.has('tier:u-inval')).toBe(false);

    await gate.requireTier(requestFor('u-inval'), supabase.client as never, 'strategist');
    expect(supabase.selects()).toBe(2);
  });

  it('ignores a malformed value read back from a shared Redis', async () => {
    const gate = await loadTierGate(REDIS_ENV);
    const supabase = makeSupabase({
      role: 'user',
      subscription_tier: 'oracle',
      subscription_expires_at: null,
    });

    mocks.state.store.set('tier:u-garbage', {
      value: JSON.stringify({ v: { role: 'user', tier: 'platinum', expiresAt: Date.now() + 10_000 } }),
      expiresAt: Date.now() + 10_000,
    });

    const denied = await gate.requireTier(requestFor('u-garbage'), supabase.client as never, 'oracle');
    // Falls back to the DB row (oracle) rather than trusting 'platinum'.
    expect(denied).toBeNull();
    expect(supabase.selects()).toBe(1);
  });
});

describe('tierGate fallback when Redis is unavailable', () => {
  it('still resolves the tier with no Upstash env configured', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const gate = await loadTierGate({});
    const supabase = makeSupabase({
      role: 'user',
      subscription_tier: 'strategist',
      subscription_expires_at: null,
    });

    await expect(
      gate.requireTier(requestFor('u-noredis'), supabase.client as never, 'strategist'),
    ).resolves.toBeNull();
    await expect(
      gate.requireTier(requestFor('u-noredis'), supabase.client as never, 'oracle'),
    ).resolves.not.toBeNull();
  });

  it('still caches in-process when Redis is unavailable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const gate = await loadTierGate({});
    const supabase = makeSupabase({
      role: 'user',
      subscription_tier: 'oracle',
      subscription_expires_at: null,
    });

    await gate.requireTier(requestFor('u-local'), supabase.client as never, 'strategist');
    await gate.requireTier(requestFor('u-local'), supabase.client as never, 'strategist');
    expect(supabase.selects()).toBe(1);
  });

  it('still resolves the tier when every Redis call throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const gate = await loadTierGate(REDIS_ENV);
    const supabase = makeSupabase({
      role: 'user',
      subscription_tier: 'oracle',
      subscription_expires_at: null,
    });

    mocks.state.fail.get = true;
    mocks.state.fail.set = true;

    await expect(
      gate.requireTier(requestFor('u-allfail'), supabase.client as never, 'oracle'),
    ).resolves.toBeNull();
    expect(supabase.selects()).toBe(1);
  });
});

describe('getEffectiveTier', () => {
  it('returns free for unauthenticated requests', async () => {
    const gate = await loadTierGate(REDIS_ENV);
    const supabase = makeSupabase(null);
    const req = { ...requestFor('u-anon'), user: undefined } as unknown as NormalizedRequest;

    await expect(gate.getEffectiveTier(req, supabase.client as never)).resolves.toEqual({
      tier: 'free',
      isAdmin: false,
    });
    expect(supabase.selects()).toBe(0);
  });

  it('shares the cache with requireTier', async () => {
    const gate = await loadTierGate(REDIS_ENV);
    const supabase = makeSupabase({
      role: 'user',
      subscription_tier: 'oracle',
      subscription_expires_at: null,
    });
    const req = requestFor('u-shared');

    await gate.requireTier(req, supabase.client as never, 'strategist');
    await expect(gate.getEffectiveTier(req, supabase.client as never)).resolves.toEqual({
      tier: 'oracle',
      isAdmin: false,
    });
    expect(supabase.selects()).toBe(1);
  });

  it('reports isAdmin for admin rows', async () => {
    const gate = await loadTierGate(REDIS_ENV);
    const supabase = makeSupabase({
      role: 'admin',
      subscription_tier: 'free',
      subscription_expires_at: null,
    });

    await expect(
      gate.getEffectiveTier(requestFor('u-admin-tier'), supabase.client as never),
    ).resolves.toEqual({ tier: 'free', isAdmin: true });
  });
});
