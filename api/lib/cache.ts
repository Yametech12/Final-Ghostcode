/**
 * Cache layer — Upstash Redis (REST) primary, bounded process-local LRU fallback.
 *
 * WHY REST AND NOT TCP
 * --------------------
 * Vercel serverless functions are frozen between invocations and unfrozen per
 * request. A TCP connection pool cannot survive that lifecycle: the socket is
 * closed when the instance freezes, and every cold start would pay a fresh
 * DNS + TLS + AUTH round trip. `@upstash/redis` speaks plain HTTPS, so the same
 * client works in the Node runtime, the Edge runtime and local Express with no
 * socket state to manage.
 *
 * FAILURE SEMANTICS — NEVER SILENT FAIL-OPEN
 * ------------------------------------------
 *  1. Env vars missing (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`):
 *     the module logs ONE warning at first use and serves from the bounded
 *     process-local LRU. Reads and writes keep working — the scope is just
 *     per-instance instead of global. `redisAvailable` is exported so callers
 *     and telemetry can see which mode is live.
 *  2. A Redis call throws: the error is logged with the key and the error
 *     message — never the cached value, which may be sensitive — and the call
 *     degrades to the same bounded LRU. For `incr` this means rate limiting
 *     keeps enforcing a limit locally instead of letting every request through.
 *     That is the difference between "degraded" and "open".
 *
 * The fallback store is bounded (LOCAL_MAX_ENTRIES) with expired-entry sweeping
 * on write, so a long-lived instance cannot leak memory the way an unbounded
 * `Map` would.
 */

import type { Redis } from '@upstash/redis';

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export interface Cache {
  /** Read a value. Returns null on miss, expiry, or `null`-valued entries. */
  get<T>(key: string): Promise<T | null>;
  /** Write a value with a TTL in seconds. */
  set<T>(key: string, value: T, ttlSec?: number): Promise<void>;
  /** Remove a key. */
  del(key: string): Promise<void>;
  /**
   * Atomic counter. Returns 1 on the first call and the incremented value
   * afterwards. Sets the TTL only when the key is created, so the window does
   * not slide forward on every request (fixed-window semantics).
   */
  incr(key: string, ttlSec?: number): Promise<number>;
  /** Set/refresh the TTL of an existing key. */
  expire(key: string, ttlSec: number): Promise<void>;
  /** Remaining TTL in seconds (-2 unknown/killed, -1 no expiry). */
  ttl(key: string): Promise<number>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_TTL_SEC = 60;
const LOCAL_MAX_ENTRIES = 1_000;
const KEY_PREFIX = process.env.REDIS_KEY_PREFIX ?? '';

function readEnv(name: string): string {
  const raw = process.env[name];
  return typeof raw === 'string' ? raw.trim() : '';
}

const redisUrl = readEnv('UPSTASH_REDIS_REST_URL');
const redisToken = readEnv('UPSTASH_REDIS_REST_TOKEN');

/** True when both Upstash env vars are present. Snapshot at module load. */
export const redisAvailable: boolean = redisUrl.length > 0 && redisToken.length > 0;

/** Reason string for telemetry / logs. */
export const cacheMode: 'redis' | 'process-local' = redisAvailable ? 'redis' : 'process-local';

// ---------------------------------------------------------------------------
// Logging — key + error only, never the value
// ---------------------------------------------------------------------------

function warn(tag: string, detail: Record<string, unknown>): void {
  try {
    console.warn(`[cache] ${tag} ${JSON.stringify(detail)}`);
  } catch {
    console.warn(`[cache] ${tag}`);
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

let warnedAboutMissingConfig = false;
function warnMissingConfigOnce(): void {
  if (warnedAboutMissingConfig) return;
  warnedAboutMissingConfig = true;
  warn('upstash_not_configured', {
    mode: 'process-local',
    hint: 'set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for a shared cache',
  });
}

// ---------------------------------------------------------------------------
// Process-local bounded LRU fallback
// ---------------------------------------------------------------------------

interface LocalEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * Map iteration order is insertion order, so a delete+set on read gives us LRU
 * recency without pulling in a dependency.
 */
const localStore = new Map<string, LocalEntry>();

function localSweep(now: number): void {
  for (const [key, entry] of localStore) {
    if (entry.expiresAt <= now) localStore.delete(key);
  }
}

function localEvictIfFull(now: number): void {
  if (localStore.size < LOCAL_MAX_ENTRIES) return;
  localSweep(now);
  while (localStore.size >= LOCAL_MAX_ENTRIES) {
    const oldest = localStore.keys().next().value;
    if (oldest === undefined) break;
    localStore.delete(oldest);
  }
}

function localGet<T>(key: string): T | null {
  const entry = localStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    localStore.delete(key);
    return null;
  }
  localStore.delete(key);
  localStore.set(key, entry);
  return entry.value as T;
}

function localSet<T>(key: string, value: T, ttlSec: number): void {
  const now = Date.now();
  localEvictIfFull(now);
  localStore.set(key, { value, expiresAt: now + ttlSec * 1000 });
}

/** Atomic-enough counter for a single instance. Keeps the original window. */
function localIncr(key: string, ttlSec: number): number {
  const now = Date.now();
  const existing = localStore.get(key);
  if (existing && existing.expiresAt > now) {
    const next = Number(existing.value) + 1;
    existing.value = next;
    return next;
  }
  localEvictIfFull(now);
  localStore.set(key, { value: 1, expiresAt: now + ttlSec * 1000 });
  return 1;
}

/**
 * Clear fallback entries. Used by tests and by cache-key invalidation helpers.
 * Passing a prefix only clears matching keys.
 */
export function clearLocalCache(prefix?: string): void {
  if (!prefix) {
    localStore.clear();
    return;
  }
  for (const key of [...localStore.keys()]) {
    if (key.startsWith(prefix)) localStore.delete(key);
  }
}

/** Number of live entries in the fallback store (telemetry / tests). */
export function localCacheSize(): number {
  return localStore.size;
}

// ---------------------------------------------------------------------------
// Redis client — lazily created, lazily IMPORTED
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;
let redisInitFailed = false;

/**
 * The SDK is imported dynamically on purpose: when Upstash is not configured
 * (local dev, unit tests) the module is never loaded, so nothing in the import
 * graph can touch the network or require a `fetch` global.
 */
async function getRedis(): Promise<Redis | null> {
  if (!redisAvailable || redisInitFailed) return null;
  if (redisClient) return redisClient;
  try {
    const mod = await import('@upstash/redis');
    redisClient = new mod.Redis({
      url: redisUrl,
      token: redisToken,
      // Deterministic read path: we own (de)serialisation via the { v } wrapper
      // below, so the SDK must not silently JSON.parse numbers/objects for us.
      automaticDeserialization: false,
    });
    return redisClient;
  } catch (err) {
    redisInitFailed = true;
    warn('upstash_init_failed', { err: describeError(err) });
    return null;
  }
}

/** Test hook: drop the memoised client so the next call re-reads the env. */
export function __resetCacheClientForTests(): void {
  redisClient = null;
  redisInitFailed = false;
}

// ---------------------------------------------------------------------------
// (De)serialisation
//
// Values are wrapped as `{ v: value }` so that a stored `null`, `0`, `false`
// or a bare JSON-shaped string can never be confused with an SDK-side
// auto-parse. Both a raw string and an already-parsed object are accepted on
// read, because a Redis client is free to auto-deserialise.
// ---------------------------------------------------------------------------

const VALUE_KEY = 'v';

function serialise(value: unknown): string {
  return JSON.stringify({ [VALUE_KEY]: value });
}

function unwrap<T>(parsed: unknown): T | null {
  if (parsed === null || parsed === undefined) return null;
  if (typeof parsed === 'object' && parsed !== null && VALUE_KEY in (parsed as Record<string, unknown>)) {
    const inner = (parsed as Record<string, unknown>)[VALUE_KEY];
    return (inner === undefined ? null : inner) as T | null;
  }
  return parsed as T;
}

function deserialise<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return unwrap<T>(raw);
  try {
    return unwrap<T>(JSON.parse(raw));
  } catch {
    // Not our wrapper (foreign value in a shared Redis) — hand it back as-is.
    return raw as unknown as T;
  }
}

function redisKey(key: string): string {
  return KEY_PREFIX ? `${KEY_PREFIX}${key}` : key;
}

// ---------------------------------------------------------------------------
// Cache implementation
// ---------------------------------------------------------------------------

function requireTtl(ttlSec: number | undefined): number {
  const ttl = typeof ttlSec === 'number' && Number.isFinite(ttlSec) && ttlSec > 0 ? ttlSec : DEFAULT_TTL_SEC;
  return Math.floor(ttl);
}

export const cache: Cache = {
  async get<T>(key: string): Promise<T | null> {
    const client = await getRedis();
    if (!client) {
      warnMissingConfigOnce();
      return localGet<T>(key);
    }
    try {
      const raw = await client.get(redisKey(key));
      return deserialise<T>(raw);
    } catch (err) {
      warn('get_failed', { key, err: describeError(err) });
      return localGet<T>(key);
    }
  },

  async set<T>(key: string, value: T, ttlSec?: number): Promise<void> {
    const ttl = requireTtl(ttlSec);
    const client = await getRedis();
    if (!client) {
      warnMissingConfigOnce();
      localSet(key, value, ttl);
      return;
    }
    try {
      await client.set(redisKey(key), serialise(value), { ex: ttl });
    } catch (err) {
      warn('set_failed', { key, err: describeError(err) });
      localSet(key, value, ttl);
    }
  },

  async del(key: string): Promise<void> {
    // Always clear the local copy first so an un-awaited caller still sees the
    // deletion applied to its own instance.
    clearLocalCache(key);
    const client = await getRedis();
    if (!client) {
      warnMissingConfigOnce();
      return;
    }
    try {
      await client.del(redisKey(key));
    } catch (err) {
      warn('del_failed', { key, err: describeError(err) });
    }
  },

  async incr(key: string, ttlSec?: number): Promise<number> {
    const ttl = requireTtl(ttlSec);
    const client = await getRedis();
    if (!client) {
      warnMissingConfigOnce();
      return localIncr(key, ttl);
    }
    try {
      const next = await client.incr(redisKey(key));
      // Only the creating call sets the window, otherwise the window would
      // slide forward on every request and never expire.
      if (next === 1) await client.expire(redisKey(key), ttl);
      return next;
    } catch (err) {
      warn('incr_failed', { key, err: describeError(err) });
      return localIncr(key, ttl);
    }
  },

  async expire(key: string, ttlSec: number): Promise<void> {
    const ttl = requireTtl(ttlSec);
    const client = await getRedis();
    if (!client) {
      warnMissingConfigOnce();
      const entry = localStore.get(key);
      if (entry) entry.expiresAt = Date.now() + ttl * 1000;
      return;
    }
    try {
      await client.expire(redisKey(key), ttl);
    } catch (err) {
      warn('expire_failed', { key, err: describeError(err) });
      const entry = localStore.get(key);
      if (entry) entry.expiresAt = Date.now() + ttl * 1000;
    }
  },

  async ttl(key: string): Promise<number> {
    const client = await getRedis();
    if (!client) {
      const entry = localStore.get(key);
      if (!entry) return -2;
      const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
      return remaining < 0 ? -2 : remaining;
    }
    try {
      return await client.ttl(redisKey(key));
    } catch (err) {
      warn('ttl_failed', { key, err: describeError(err) });
      const entry = localStore.get(key);
      if (!entry) return -2;
      const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
      return remaining < 0 ? -2 : remaining;
    }
  },
};

// ---------------------------------------------------------------------------
// Helpers built on the cache
// ---------------------------------------------------------------------------

/**
 * Cache-aside helper. On a Redis failure the fallback still runs and the write
 * is skipped with a warning — a broken cache must never break the request.
 */
export async function withCache<T>(
  key: string,
  ttlSec: number,
  fallback: () => T | Promise<T>,
): Promise<T> {
  try {
    const hit = await cache.get<T>(key);
    if (hit !== null) return hit;
  } catch (err) {
    warn('with_cache_read_failed', { key, err: describeError(err) });
  }

  const value = await fallback();

  try {
    await cache.set(key, value, ttlSec);
  } catch (err) {
    warn('with_cache_write_failed', { key, err: describeError(err) });
  }

  return value;
}

/**
 * Fixed-window rate limit. `allowed` is true for exactly `limit` requests per
 * `windowSec`; the (limit + 1)th is rejected. Never rejects — a Redis outage
 * degrades to the bounded local bucket, which still enforces `limit`.
 */
export async function tryRedisRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const count = await cache.incr(key, windowSec);
  const remaining = Math.max(0, limit - count);
  const allowed = count <= limit;

  let ttlSec = await cache.ttl(key);
  if (!Number.isFinite(ttlSec) || ttlSec < 0) ttlSec = windowSec;

  return { allowed, remaining, resetMs: ttlSec * 1000 };
}
