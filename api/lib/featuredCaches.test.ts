import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => {
  interface Entry {
    value: unknown;
    expiresAt: number | null;
  }

  const state = {
    store: new Map<string, Entry>(),
    delCalls: [] as string[],
    fail: { get: false, set: false },
    reset() {
      state.store.clear();
      state.delCalls = [];
      state.fail = { get: false, set: false };
    },
  };

  class Redis {
    async get(key: string): Promise<unknown> {
      if (state.fail.get) throw new Error('redis down: get');
      const entry = state.store.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
        state.store.delete(key);
        return null;
      }
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
      state.delCalls.push(key);
      return state.store.delete(key) ? 1 : 0;
    }

    async incr(key: string): Promise<number> {
      const entry = state.store.get(key);
      const next = (entry ? Number(entry.value) : 0) + 1;
      state.store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
      return next;
    }

    async expire(key: string, sec: number): Promise<number> {
      const entry = state.store.get(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + sec * 1000;
      return 1;
    }

    async ttl(key: string): Promise<number> {
      const entry = state.store.get(key);
      if (!entry) return -2;
      if (entry.expiresAt === null) return -1;
      const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
      return remaining < 0 ? -2 : remaining;
    }
  }

  return { state, Redis };
});

vi.mock('@upstash/redis', () => ({ Redis: mocks.Redis }));

type FeaturedModule = typeof import('./featuredCaches.js');

const REDIS_ENV = {
  UPSTASH_REDIS_REST_URL: 'https://featured-test.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-token',
};

async function loadFeatured(env: Record<string, string>): Promise<FeaturedModule> {
  vi.resetModules();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', env.UPSTASH_REDIS_REST_URL ?? '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', env.UPSTASH_REDIS_REST_TOKEN ?? '');
  return (await import('./featuredCaches.js')) as FeaturedModule;
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

describe('getCachedPromptBlock', () => {
  it('invokes the loader once and serves the second read from cache', async () => {
    const mod = await loadFeatured(REDIS_ENV);
    const loader = vi.fn().mockReturnValue('STATIC PROMPT BLOCK');

    await expect(mod.getCachedPromptBlock('prompt:test', 300, loader)).resolves.toBe('STATIC PROMPT BLOCK');
    await expect(mod.getCachedPromptBlock('prompt:test', 300, loader)).resolves.toBe('STATIC PROMPT BLOCK');

    expect(loader).toHaveBeenCalledTimes(1);
    expect(mocks.state.store.has('prompt:test')).toBe(true);
  });

  it('keeps separate blocks under separate keys', async () => {
    const mod = await loadFeatured(REDIS_ENV);
    const frameworkLoader = vi.fn().mockReturnValue('FRAMEWORK');
    const guidelinesLoader = vi.fn().mockReturnValue('GUIDELINES');

    await mod.getCachedPromptBlock(mod.PROMPT_TYPE_FRAMEWORK_KEY, 300, frameworkLoader);
    await mod.getCachedPromptBlock(mod.PROMPT_RESPONSE_GUIDELINES_KEY, 300, guidelinesLoader);

    await expect(
      mod.getCachedPromptBlock(mod.PROMPT_TYPE_FRAMEWORK_KEY, 300, frameworkLoader),
    ).resolves.toBe('FRAMEWORK');
    await expect(
      mod.getCachedPromptBlock(mod.PROMPT_RESPONSE_GUIDELINES_KEY, 300, guidelinesLoader),
    ).resolves.toBe('GUIDELINES');

    expect(frameworkLoader).toHaveBeenCalledTimes(1);
    expect(guidelinesLoader).toHaveBeenCalledTimes(1);
  });

  it('falls through to the loader when Redis is not configured', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await loadFeatured(REDIS_ENV);
    mocks.state.fail.get = true;
    mocks.state.fail.set = true;

    const loader = vi.fn().mockReturnValue('IN-PROCESS CONSTANT');
    await expect(mod.getCachedPromptBlock('prompt:degraded', 300, loader)).resolves.toBe('IN-PROCESS CONSTANT');
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe('getPersonalityTypeContext', () => {
  it('keys the cache per type id, not per user', async () => {
    const mod = await loadFeatured(REDIS_ENV);
    const loader = vi.fn((id: string) => `context for ${id}`);

    await expect(mod.getPersonalityTypeContext('TDI', loader)).resolves.toBe('context for TDI');
    await expect(mod.getPersonalityTypeContext('TDI', loader)).resolves.toBe('context for TDI');

    expect(loader).toHaveBeenCalledTimes(1);
    expect(mocks.state.store.has('prompt:advisor:type-context:TDI')).toBe(true);
  });

  it('caches each type independently', async () => {
    const mod = await loadFeatured(REDIS_ENV);
    const loader = vi.fn((id: string) => `context for ${id}`);

    await mod.getPersonalityTypeContext('TJI', loader);
    await mod.getPersonalityTypeContext('NJR', loader);

    expect(loader).toHaveBeenCalledTimes(2);
    expect(mocks.state.store.has('prompt:advisor:type-context:TJI')).toBe(true);
    expect(mocks.state.store.has('prompt:advisor:type-context:NJR')).toBe(true);
  });

  it('never puts a user identifier in the cache key', async () => {
    const mod = await loadFeatured(REDIS_ENV);
    await mod.getPersonalityTypeContext('TDR', (id) => `context for ${id}`);

    const keys = [...mocks.state.store.keys()];
    expect(keys).toEqual(['prompt:advisor:type-context:TDR']);
    expect(keys.join()).not.toMatch(/@|user|email/i);
  });
});

describe('getPersonalityTypeCatalog', () => {
  it('caches the whole catalog', async () => {
    const mod = await loadFeatured(REDIS_ENV);
    const catalog = [
      { id: 'TDI', context: 'a' },
      { id: 'TJI', context: 'b' },
    ];
    const loader = vi.fn().mockReturnValue(catalog);

    await expect(mod.getPersonalityTypeCatalog(loader)).resolves.toEqual(catalog);
    await expect(mod.getPersonalityTypeCatalog(loader)).resolves.toEqual(catalog);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe('invalidateFeaturedCaches', () => {
  it('drops the framework, guidelines and catalog keys', async () => {
    const mod = await loadFeatured(REDIS_ENV);

    await mod.getCachedPromptBlock(mod.PROMPT_TYPE_FRAMEWORK_KEY, 300, () => 'F');
    await mod.getCachedPromptBlock(mod.PROMPT_RESPONSE_GUIDELINES_KEY, 300, () => 'G');
    await mod.getPersonalityTypeCatalog(() => [{ id: 'TDI', context: 'a' }]);
    expect(mocks.state.store.size).toBe(3);

    await mod.invalidateFeaturedCaches();

    expect(mocks.state.delCalls).toEqual(
      expect.arrayContaining([
        mod.PROMPT_TYPE_FRAMEWORK_KEY,
        mod.PROMPT_RESPONSE_GUIDELINES_KEY,
        mod.PERSONALITY_CATALOG_KEY,
      ]),
    );
    expect(mocks.state.store.size).toBe(0);
  });

  it('forces the loader to run again after invalidation', async () => {
    const mod = await loadFeatured(REDIS_ENV);
    const loader = vi.fn().mockReturnValue('BLOCK');

    const key = mod.PROMPT_TYPE_FRAMEWORK_KEY;
    await mod.getCachedPromptBlock(key, 300, loader);
    await mod.invalidateFeaturedCaches();
    await mod.invalidateFeaturedCaches();
    await mod.getCachedPromptBlock(key, 300, loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe('TTL conventions', () => {
  it('uses the documented TTLs for each cache class', async () => {
    const mod = await loadFeatured(REDIS_ENV);
    expect(mod.PROMPT_BLOCK_TTL_SEC).toBe(300);
    expect(mod.TYPE_CONTEXT_TTL_SEC).toBe(3600);
    expect(mod.PERSONALITY_CATALOG_TTL_SEC).toBe(3600);
  });

  it('applies the TTL to the Redis write', async () => {
    const mod = await loadFeatured(REDIS_ENV);
    await mod.getCachedPromptBlock('prompt:ttl', 300, () => 'v');

    const entry = mocks.state.store.get('prompt:ttl');
    expect(entry?.expiresAt).toBeGreaterThan(Date.now());
    expect(entry?.expiresAt).toBeLessThanOrEqual(Date.now() + 300_500);
  });
});
