import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAuthenticatedUser, isValidUUID, __resetAuthCacheForTests } from './auth';

/**
 * Build a minimal Supabase client double whose `auth.getUser` returns the
 * configured response. We don't need the rest of the SupabaseClient surface
 * here, so we cast through `unknown` to satisfy the parameter type.
 */
function makeSupabaseDouble(response: { data?: any; error?: any }) {
  const getUser = vi.fn().mockResolvedValue(response);
  return {
    client: { auth: { getUser } } as any,
    getUser,
  };
}

beforeEach(() => {
  // The token cache is module-level — clear it between tests so a token
  // string used in one test doesn't carry over a positive/negative entry
  // into the next.
  __resetAuthCacheForTests();
});

describe('getAuthenticatedUser', () => {
  it('returns null and does not call Supabase when header is missing', async () => {
    const { client, getUser } = makeSupabaseDouble({ data: { user: null }, error: null });
    expect(await getAuthenticatedUser(undefined, client)).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('returns null for an empty header', async () => {
    const { client, getUser } = makeSupabaseDouble({ data: { user: null }, error: null });
    expect(await getAuthenticatedUser('', client)).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('returns null when the prefix is not Bearer', async () => {
    const { client, getUser } = makeSupabaseDouble({ data: { user: null }, error: null });
    expect(await getAuthenticatedUser('Basic abc', client)).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('returns null when Bearer is followed by only whitespace', async () => {
    const { client, getUser } = makeSupabaseDouble({ data: { user: null }, error: null });
    expect(await getAuthenticatedUser('Bearer   ', client)).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('returns the user when Supabase resolves a user', async () => {
    const fakeUser = { id: 'u-1', email: 'a@b.c' };
    const { client, getUser } = makeSupabaseDouble({ data: { user: fakeUser }, error: null });
    const result = await getAuthenticatedUser('Bearer real-token', client);
    expect(result).toEqual(fakeUser);
    expect(getUser).toHaveBeenCalledWith('real-token');
  });

  it('returns null on Supabase error', async () => {
    const { client } = makeSupabaseDouble({ data: { user: null }, error: { message: 'expired' } });
    expect(await getAuthenticatedUser('Bearer x', client)).toBeNull();
  });

  it('returns null when getUser throws', async () => {
    const getUser = vi.fn().mockRejectedValue(new Error('network'));
    const client = { auth: { getUser } } as any;
    expect(await getAuthenticatedUser('Bearer x', client)).toBeNull();
  });
});

describe('isValidUUID', () => {
  it('accepts v1–v5 UUIDs', () => {
    // v1 has version nibble 1, v4 has 4
    expect(isValidUUID('550e8400-e29b-11d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    // upper-case
    expect(isValidUUID('550E8400-E29B-51D4-A716-446655440000')).toBe(true);
  });

  it('rejects empty / null / undefined', () => {
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID(null)).toBe(false);
    expect(isValidUUID(undefined)).toBe(false);
  });

  it('rejects non-UUID strings', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
  });

  it('rejects v6+ version nibble', () => {
    expect(isValidUUID('550e8400-e29b-61d4-a716-446655440000')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Token cache behaviour (H2)
// ---------------------------------------------------------------------------

describe('getAuthenticatedUser token cache', () => {
  /**
   * Build a JWT-shaped string with a payload containing the given exp (in
   * seconds since epoch). Signature is fake — we never verify it locally;
   * only the cache's exp-clamp logic reads the payload, and Supabase
   * verifies the real signature on the cache-miss path.
   */
  function fakeJwt(expSec: number): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'u', exp: expSec }))
      .toString('base64url');
    return `${header}.${payload}.fakesig`;
  }

  it('does not call Supabase a second time when the same token is reused within TTL', async () => {
    const fakeUser = { id: 'u-1', email: 'a@b.c' };
    const { client, getUser } = makeSupabaseDouble({ data: { user: fakeUser }, error: null });
    const token = fakeJwt(Math.floor(Date.now() / 1000) + 3_600);

    const r1 = await getAuthenticatedUser(`Bearer ${token}`, client);
    const r2 = await getAuthenticatedUser(`Bearer ${token}`, client);

    expect(r1).toEqual(fakeUser);
    expect(r2).toEqual(fakeUser);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('uses different cache entries for different tokens', async () => {
    const fakeUser = { id: 'u-1' };
    const { client, getUser } = makeSupabaseDouble({ data: { user: fakeUser }, error: null });
    const tokenA = fakeJwt(Math.floor(Date.now() / 1000) + 3_600);
    const tokenB = fakeJwt(Math.floor(Date.now() / 1000) + 3_601);

    await getAuthenticatedUser(`Bearer ${tokenA}`, client);
    await getAuthenticatedUser(`Bearer ${tokenB}`, client);

    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it('negative-caches invalid tokens but with a much shorter TTL', async () => {
    // Two consecutive calls with a known-invalid token should hit Supabase
    // only once thanks to the negative cache.
    const { client, getUser } = makeSupabaseDouble({
      data: { user: null },
      error: { message: 'invalid token' },
    });
    const token = 'plainstring-not-a-jwt';

    expect(await getAuthenticatedUser(`Bearer ${token}`, client)).toBeNull();
    expect(await getAuthenticatedUser(`Bearer ${token}`, client)).toBeNull();
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('does not cache thrown exceptions (transient failures should retry)', async () => {
    const getUser = vi.fn().mockRejectedValue(new Error('boom'));
    const client = { auth: { getUser } } as any;
    const token = fakeJwt(Math.floor(Date.now() / 1000) + 3_600);

    expect(await getAuthenticatedUser(`Bearer ${token}`, client)).toBeNull();
    expect(await getAuthenticatedUser(`Bearer ${token}`, client)).toBeNull();
    // Both attempts should have hit Supabase — no poisoning the cache on
    // a network blip.
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it('does not cache a token whose exp claim is already past', async () => {
    const fakeUser = { id: 'u-1' };
    const { client, getUser } = makeSupabaseDouble({ data: { user: fakeUser }, error: null });
    // exp 10s in the past — even if Supabase says it's valid, we shouldn't
    // serve a cached entry for an expired-by-claim token.
    const token = fakeJwt(Math.floor(Date.now() / 1000) - 10);

    await getAuthenticatedUser(`Bearer ${token}`, client);
    await getAuthenticatedUser(`Bearer ${token}`, client);

    expect(getUser).toHaveBeenCalledTimes(2);
  });
});
