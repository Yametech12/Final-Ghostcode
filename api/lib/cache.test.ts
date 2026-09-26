import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The Upstash SDK is mocked at the module boundary. `cache.ts` imports it with
 * a dynamic `import()` precisely so tests can intercept it here and so nothing
 * touches the network when Upstash is unconfigured.
 */
const mocks = vi.hoisted(() => {
  interface Entry {
    value: unknown;
    expiresAt: number | null;
  }

  const state = {
    store: new Map<string, Entry>(),
    expireCalls: [] as Array<{ key: string; sec: number }>,
    setCalls: [] as Array<{ key: string; ttl: number | undefined }>,
    ctorArgs: [] as Array<Record<string, unknown>>,
    fail: { get: false, set: false, del: false, incr: false, expire: false, ttl: false },
    reset() {
      state.store.clear();
      state.expireCalls = [];
      state.setCalls = [];
      state.ctorArgs = [];
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
    constructor(options: Record<string, unknown>) {
      state.ctorArgs.push(options);
    }

    async get(key: string): Promise<unknown> {
      if (state.fail.get) throw new Error('redis down: get');
      const entry = live(key);
      if (!entry) return null;
      // Mirrors `automaticDeserialization: false`: hand back the raw string.
      return typeof entry.value === 'string' ? entry.value : null;
    }

    async set(key: string, value: string, options?: { ex?: number }): Promise<string> {
      if (state.fail.set) throw new Error('redis down: set');
      state.setCalls.push({ key, ttl: options?.ex });
      state.store.set(key, {
        value,
        expiresAt: options?.ex ? Date.now() + options.ex * 1000 : null,
      });
      return 'OK';
    }

    async del(key: string): Promise<number> {
      if (state.fail.del) throw new Error('redis down: del');
      return state.store.delete(key) ? 1 : 0;
    }

    async incr(key: string): Promise<number> {
      if (state.fail.incr) throw new Error('redis down: incr');
      const entry = live(key);
      const next = (entry ? Number(entry.value) : 0) + 1;
      state.store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
      return next;
    }

    async expire(key: string, sec: number): Promise<number> {
      if (state.fail.expire) throw new Error('redis down: expire');
      state.expireCalls.push({ key, sec });
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

type CacheModule = typeof import('./cache.js');

const REDIS_ENV = {
  UPSTASH_REDIS_REST_URL: 'https://cache-test.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-token',
};

/**
 * Re-import the module so the module-level env snapshot and memoised client are
 * rebuilt. Required because the Upstash client is lazily initialised.
 */
async function loadCache(env: Record<string, string>): Promise<CacheModule> {
  vi.resetModules();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', env.UPSTASH_REDIS_REST_URL ?? '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', env.UPSTASH_REDIS_REST_TOKEN ?? '');
  return (await import('./cache.js')) as CacheModule;
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

// ---------------------------------------------------------------------------
// Redis mode
// ---------------------------------------------------------------------------

describe('cache (Upstash configured)', () => {
  it('reports redisAvailable and redis mode', async () => {
    const mod = await loadCache(REDIS_ENV);
    expect(mod.redisAvailable).toBe(true);
    expect(mod.cacheMode).toBe('redis');
  });

  it('round-trips a value through set → get', async () => {
    const mod = await loadCache(REDIS_ENV);
    await mod.cache.set('greeting', 'hello', 60);
    await expect(mod.cache.get<string>('greeting')).resolves.toBe('hello');
    expect(mocks.state.ctorArgs).toHaveLength(1);
    expect(mocks.state.ctorArgs[0]).toMatchObject({
      url: REDIS_ENV.UPSTASH_REDIS_REST_URL,
      token: REDIS_ENV.UPSTASH_REDIS_REST_TOKEN,
      automaticDeserialization: false,
    });
  });

  it('preserves falsy values instead of collapsing them to a miss', async () => {
    const mod = await loadCache(REDIS_ENV);
    await mod.cache.set('zero', 0, 60);
    await mod.cache.set('falsey', false, 60);
    await mod.cache.set('empty', '', 60);
    await mod.cache.set('nulled', null, 60);

    await expect(mod.cache.get<number>('zero')).resolves.toBe(0);
    await expect(mod.cache.get<boolean>('falsey')).resolves.toBe(false);
    await expect(mod.cache.get<string>('empty')).resolves.toBe('');
    await expect(mod.cache.get('nulled')).resolves.toBeNull();
  });

  it('is idempotent when storing null, and get returns null for a missing key', async () => {
    const mod = await loadCache(REDIS_ENV);
    await mod.cache.set('nothing', null, 60);
    await mod.cache.set('nothing', null, 60);
    await expect(mod.cache.get('nothing')).resolves.toBeNull();
    await expect(mod.cache.get('never-written')).resolves.toBeNull();
  });

  it('applies the TTL on set and reports it via ttl()', async () => {
    const mod = await loadCache(REDIS_ENV);
    await mod.cache.set('ttl-key', 'v', 30);
    expect(mocks.state.setCalls).toEqual([{ key: 'ttl-key', ttl: 30 }]);
    const ttl = await mod.cache.ttl('ttl-key');
    expect(ttl).toBeGreaterThan(25);
    expect(ttl).toBeLessThanOrEqual(30);
  });

  it('defaults the TTL when none is supplied', async () => {
    const mod = await loadCache(REDIS_ENV);
    await mod.cache.set('default-ttl', 'v');
    expect(mocks.state.setCalls[0].ttl).toBe(60);
  });

  it('del removes the key', async () => {
    const mod = await loadCache(REDIS_ENV);
    await mod.cache.set('gone', 'v', 60);
    await mod.cache.del('gone');
    await expect(mod.cache.get('gone')).resolves.toBeNull();
  });

  it('incr returns 1 on the first call and increments afterwards', async () => {
    const mod = await loadCache(REDIS_ENV);
    await expect(mod.cache.incr('counter', 60)).resolves.toBe(1);
    await expect(mod.cache.incr('counter', 60)).resolves.toBe(2);
    await expect(mod.cache.incr('counter', 60)).resolves.toBe(3);
  });

  it('sets the TTL only when incr creates the key, so the window does not slide', async () => {
    const mod = await loadCache(REDIS_ENV);
    await mod.cache.incr('window', 60);
    await mod.cache.incr('window', 60);
    await mod.cache.incr('window', 60);
    expect(mocks.state.expireCalls).toEqual([{ key: 'window', sec: 60 }]);
  });

  it('expire refreshes the TTL of an existing key', async () => {
    const mod = await loadCache(REDIS_ENV);
    await mod.cache.set('refresh', 'v', 5);
    await mod.cache.expire('refresh', 120);
    const ttl = await mod.cache.ttl('refresh');
    expect(ttl).toBeGreaterThan(100);
    expect(ttl).toBeLessThanOrEqual(120);
  });

  it('ttl reports -2 for a missing key', async () => {
    const mod = await loadCache(REDIS_ENV);
    await expect(mod.cache.ttl('absent')).resolves.toBe(-2);
  });
});

// ---------------------------------------------------------------------------
// withCache
// ---------------------------------------------------------------------------

describe('withCache', () => {
  it('calls the fallback once and serves the second read from cache', async () => {
    const mod = await loadCache(REDIS_ENV);
    const loader = vi.fn().mockResolvedValue('computed');

    await expect(mod.withCache('wc', 60, loader)).resolves.toBe('computed');
    await expect(mod.withCache('wc', 60, loader)).resolves.toBe('computed');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('treats a falsy cached value as a hit', async () => {
    const mod = await loadCache(REDIS_ENV);
    const loader = vi.fn().mockResolvedValue(0);
    await mod.withCache('wc-zero', 60, loader);
    await mod.withCache('wc-zero', 60, loader);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('still returns the fallback value when the cache read and write both fail', async () => {
    const mod = await loadCache(REDIS_ENV);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.state.fail.get = true;
    mocks.state.fail.set = true;

    const loader = vi.fn().mockResolvedValue('from-loader');
    await expect(mod.withCache('wc-down', 60, loader)).resolves.toBe('from-loader');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cache'));
  });

  it('propagates a loader error instead of masking it as a cache failure', async () => {
    const mod = await loadCache(REDIS_ENV);
    const loader = vi.fn().mockRejectedValue(new Error('loader exploded'));
    await expect(mod.withCache('wc-boom', 60, loader)).rejects.toThrow('loader exploded');
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe('tryRedisRateLimit', () => {
  it('allows exactly `limit` requests and rejects the next one', async () => {
    const mod = await loadCache(REDIS_ENV);

    const first = await mod.tryRedisRateLimit('rate:test:ip', 3, 60);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);

    const second = await mod.tryRedisRateLimit('rate:test:ip', 3, 60);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);

    const third = await mod.tryRedisRateLimit('rate:test:ip', 3, 60);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = await mod.tryRedisRateLimit('rate:test:ip', 3, 60);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.resetMs).toBeGreaterThan(0);
  });

  it('keeps separate buckets per key', async () => {
    const mod = await loadCache(REDIS_ENV);
    await mod.tryRedisRateLimit('rate:a', 1, 60);
    const other = await mod.tryRedisRateLimit('rate:b', 1, 60);
    expect(other.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Process-local fallback
// ---------------------------------------------------------------------------

describe('cache (Upstash not configured)', () => {
  it('reports process-local mode and warns exactly once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await loadCache({});

    expect(mod.redisAvailable).toBe(false);
    expect(mod.cacheMode).toBe('process-local');

    await mod.cache.set('local', 'value', 60);
    await mod.cache.set('local-2', 'value-2', 60);

    const configWarnings = warn.mock.calls.filter((call) =>
      String(call[0]).includes('upstash_not_configured'),
    );
    expect(configWarnings).toHaveLength(1);
    expect(mocks.state.ctorArgs).toHaveLength(0);
  });

  it('round-trips values through the process-local store', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await loadCache({});

    await mod.cache.set('k', { nested: [1, 2, 3] }, 60);
    await expect(mod.cache.get<{ nested: number[] }>('k')).resolves.toEqual({ nested: [1, 2, 3] });

    await mod.cache.del('k');
    await expect(mod.cache.get('k')).resolves.toBeNull();
  });

  it('incr enforces a local counter with the same limit semantics', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await loadCache({});

    const first = await mod.tryRedisRateLimit('rate:local', 2, 60);
    const second = await mod.tryRedisRateLimit('rate:local', 2, 60);
    const third = await mod.tryRedisRateLimit('rate:local', 2, 60);

    expect([first.allowed, second.allowed, third.allowed]).toEqual([true, true, false]);
    expect(first.remaining).toBe(1);
  });

  it('keeps the fallback store bounded', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await loadCache({});

    for (let i = 0; i < 1_500; i += 1) {
      await mod.cache.set(`bulk-${i}`, i, 60);
    }

    expect(mod.localCacheSize()).toBeLessThanOrEqual(1_000);
  });

  it('expires process-local entries by TTL', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await loadCache({});

    vi.useFakeTimers();
    try {
      await mod.cache.set('short', 'v', 1);
      await expect(mod.cache.get('short')).resolves.toBe('v');
      vi.advanceTimersByTime(1_100);
      await expect(mod.cache.get('short')).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// Failure degradation with Redis configured
// ---------------------------------------------------------------------------

describe('cache degradation when Redis calls fail', () => {
  it('does not throw and serves the value from the bounded local fallback', async () => {
    const mod = await loadCache(REDIS_ENV);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Healthy write, then the connection starts failing.
    await mod.cache.set('flaky', 'still-here', 60);
    mocks.state.fail.get = true;

    await expect(mod.cache.get<string>('flaky')).resolves.toBeNull();

    // With both directions failing the fallback becomes the source of truth.
    mocks.state.fail.set = true;
    await mod.cache.set('flaky', 'local-copy', 60);
    await expect(mod.cache.get<string>('flaky')).resolves.toBe('local-copy');

    const logged = warn.mock.calls.map((call) => String(call[0]));
    expect(logged.some((line) => line.includes('get_failed'))).toBe(true);
    expect(logged.some((line) => line.includes('set_failed'))).toBe(true);
  });

  it('never logs the cached value, only the key and the error', async () => {
    const mod = await loadCache(REDIS_ENV);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const secret = 'super-secret-tier-value';

    mocks.state.fail.set = true;
    await mod.cache.set('secret-key', secret, 60);

    const serialisedCalls = warn.mock.calls.map((call) => String(call[0])).join('\n');
    expect(serialisedCalls).toContain('secret-key');
    expect(serialisedCalls).not.toContain(secret);
  });

  it('falls back to a local counter for rate limiting instead of failing open', async () => {
    const mod = await loadCache(REDIS_ENV);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.state.fail.incr = true;

    const results = [];
    for (let i = 0; i < 4; i += 1) {
      results.push(await mod.tryRedisRateLimit('rate:degraded', 3, 60));
    }

    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
  });
});

// ---------------------------------------------------------------------------
// Reset helper
// ---------------------------------------------------------------------------

describe('clearLocalCache', () => {
  it('clears everything without a prefix and only matches with one', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await loadCache({});

    await mod.cache.set('tier:a', 'A', 60);
    await mod.cache.set('rate:x', 'X', 60);
    expect(mod.localCacheSize()).toBe(2);

    mod.clearLocalCache('tier:');
    expect(mod.localCacheSize()).toBe(1);
    await expect(mod.cache.get('tier:a')).resolves.toBeNull();
    await expect(mod.cache.get('rate:x')).resolves.toBe('X');

    mod.clearLocalCache();
    expect(mod.localCacheSize()).toBe(0);
  });
});
