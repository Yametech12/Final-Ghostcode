import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDeleteMyAccount } from '../account';
import { handleAdminDeleteUser } from '../admin';
import type { NormalizedRequest } from '../../types';
import { makeSupabaseDouble, USER_A, USER_B } from '../../testHelpers/supabaseDouble';

function makeReq(over: Partial<NormalizedRequest> = {}): NormalizedRequest {
  return { method: 'DELETE', body: {}, query: {}, params: {}, headers: {}, user: null, ...over };
}

const fakeUser = { id: USER_A, email: 'u@example.com' } as any;

describe('account module — handleDeleteMyAccount', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('returns 401 when unauthenticated', async () => {
    const r = await handleDeleteMyAccount(makeReq({ user: null }), makeSupabaseDouble());
    expect(r.status).toBe(401);
  });

  it('returns 400 CONFIRM_REQUIRED when confirm is not a string', async () => {
    const r = await handleDeleteMyAccount(makeReq({ user: fakeUser, body: {} }), makeSupabaseDouble());
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('CONFIRM_REQUIRED');
  });

  it('returns 400 CONFIRM_MISMATCH when the phrase is wrong', async () => {
    const r = await handleDeleteMyAccount(makeReq({ user: fakeUser, body: { confirm: 'wrong@example.com' } }), makeSupabaseDouble());
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('CONFIRM_MISMATCH');
  });

  it('accepts a case-insensitive, whitespace-padded match', async () => {
    const r = await handleDeleteMyAccount(
      makeReq({ user: fakeUser, body: { confirm: '  U@EXAMPLE.COM  ' } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true });
  });

  it('returns 500 DELETE_FAILED when the public.users delete fails', async () => {
    const client = makeSupabaseDouble({ deleteResult: { error: { message: 'fk violation' } } });
    const r = await handleDeleteMyAccount(
      makeReq({ user: fakeUser, body: { confirm: 'u@example.com' } }),
      client,
    );
    expect(r.status).toBe(500);
    expect(r.body.code).toBe('DELETE_FAILED');
  });
});

describe('admin module — handleAdminDeleteUser', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('returns 401 when unauthenticated', async () => {
    const r = await handleAdminDeleteUser(makeReq({ user: null, params: { id: USER_B } }), makeSupabaseDouble());
    expect(r.status).toBe(401);
  });

  it('returns 400 INVALID_USER_ID when the id is not a UUID', async () => {
    const r = await handleAdminDeleteUser(makeReq({ user: fakeUser, params: { id: 'nope' } }), makeSupabaseDouble());
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('INVALID_USER_ID');
  });

  it('refuses self-deletion with 400 CANNOT_SELF_DELETE', async () => {
    const r = await handleAdminDeleteUser(makeReq({ user: fakeUser, params: { id: USER_A } }), makeSupabaseDouble());
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('CANNOT_SELF_DELETE');
  });

  it('returns 403 FORBIDDEN for a non-admin caller', async () => {
    const client = makeSupabaseDouble({ usersRow: { role: 'user', subscription_tier: 'oracle', subscription_expires_at: null } });
    const r = await handleAdminDeleteUser(makeReq({ user: fakeUser, params: { id: USER_B } }), client);
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN');
  });

  it('deletes when the caller is an admin', async () => {
    const client = makeSupabaseDouble({ usersRow: { role: 'admin', subscription_tier: 'free', subscription_expires_at: null } });
    const r = await handleAdminDeleteUser(makeReq({ user: fakeUser, params: { id: USER_B } }), client);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true });
  });

  it('returns 500 AUTH_CHECK_FAILED when the caller lookup errors', async () => {
    const client = makeSupabaseDouble({ usersRow: null });
    // Force the users row lookup to surface an error through the double.
    client.from = (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => (table === 'users' ? { data: null, error: { message: 'db down' } } : { data: null, error: null }),
        }),
      }),
    });
    const r = await handleAdminDeleteUser(makeReq({ user: fakeUser, params: { id: USER_B } }), client);
    expect(r.status).toBe(500);
    expect(r.body.code).toBe('AUTH_CHECK_FAILED');
  });
});
