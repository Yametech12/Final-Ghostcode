import { describe, it, expect, vi } from 'vitest';
import { getAuthenticatedUser, isValidUUID } from './auth';

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
