import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleCreateAdvisorSession,
  handleGetAdvisorSession,
  handleDeleteAdvisorSession,
  handleUpdateAdvisorReaction,
  handleAdvisorChatStream,
} from '../advisor';
import type { NormalizedRequest } from '../../types';
import { makeSupabaseDouble, USER_A, USER_B } from '../../testHelpers/supabaseDouble';
import { __resetTierCacheForTests } from '../../tierGate';

vi.mock('../../../_config.js', () => ({
  DEFAULT_MODEL: 'fake',
  VISION_MODEL: 'fake',
  createCompletion: vi.fn(),
}));

const fakeUser = { id: USER_A, email: 'u@example.com' } as any;
const SESSION_ID = '880e8400-e29b-41d4-a716-446655440003';
const MESSAGE_ID = '990e8400-e29b-41d4-a716-446655440004';

function makeReq(over: Partial<NormalizedRequest> = {}): NormalizedRequest {
  return { method: 'POST', body: {}, query: {}, params: {}, headers: {}, user: fakeUser, ...over };
}

const freeRow = { role: 'user', subscription_tier: 'free', subscription_expires_at: null };

describe('advisor module — handleCreateAdvisorSession', () => {
  beforeEach(() => __resetTierCacheForTests());

  it('returns 401 when unauthenticated', async () => {
    const r = await handleCreateAdvisorSession(makeReq({ user: null }), makeSupabaseDouble());
    expect(r.status).toBe(401);
  });

  it('returns 402 for a free-tier caller (server-side gate)', async () => {
    const client = makeSupabaseDouble({ usersRow: freeRow });
    const r = await handleCreateAdvisorSession(makeReq({ body: {} }), client);
    expect(r.status).toBe(402);
    expect(r.body.code).toBe('PAYMENT_REQUIRED');
    expect(r.body.requiredTier).toBe('strategist');
  });

  it('returns the new sessionId on success', async () => {
    const client = makeSupabaseDouble({ insertSingle: { data: { id: SESSION_ID }, error: null } });
    const r = await handleCreateAdvisorSession(makeReq({ body: {} }), client);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ sessionId: SESSION_ID });
  });

  it('returns 500 when the insert fails', async () => {
    const client = makeSupabaseDouble({ insertSingle: { data: null, error: { message: 'boom' } } });
    const r = await handleCreateAdvisorSession(makeReq({ body: {} }), client);
    expect(r.status).toBe(500);
  });
});

describe('advisor module — handleGetAdvisorSession', () => {
  beforeEach(() => __resetTierCacheForTests());

  it('returns 401 when unauthenticated', async () => {
    const r = await handleGetAdvisorSession(makeReq({ method: 'GET', user: null }), makeSupabaseDouble());
    expect(r.status).toBe(401);
  });

  it('returns 402 for a free-tier caller', async () => {
    const client = makeSupabaseDouble({ usersRow: freeRow });
    const r = await handleGetAdvisorSession(makeReq({ method: 'GET' }), client);
    expect(r.status).toBe(402);
  });

  it('returns the empty-session shape when the user has no session yet', async () => {
    const client = makeSupabaseDouble({ selectMaybeSingle: { advisor_sessions: { data: null, error: null } } });
    const r = await handleGetAdvisorSession(makeReq({ method: 'GET' }), client);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ sessionId: null, messages: [] });
  });
});

describe('advisor module — handleDeleteAdvisorSession', () => {
  beforeEach(() => __resetTierCacheForTests());

  it('returns 400 INVALID_UUID on a malformed sessionId', async () => {
    const r = await handleDeleteAdvisorSession(makeReq({ params: { sessionId: 'nope' } }), makeSupabaseDouble());
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('INVALID_UUID');
  });

  it('returns 404 when the session belongs to another user', async () => {
    const client = makeSupabaseDouble({ selectMaybeSingle: { advisor_sessions: { data: { user_id: USER_B }, error: null } } });
    const r = await handleDeleteAdvisorSession(makeReq({ params: { sessionId: SESSION_ID } }), client);
    expect(r.status).toBe(404);
  });

  it('deletes without a tier gate even for a free-tier caller', async () => {
    const client = makeSupabaseDouble({
      usersRow: freeRow,
      selectMaybeSingle: { advisor_sessions: { data: { user_id: USER_A }, error: null } },
    });
    const r = await handleDeleteAdvisorSession(makeReq({ params: { sessionId: SESSION_ID } }), client);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true });
  });
});

describe('advisor module — handleUpdateAdvisorReaction', () => {
  beforeEach(() => __resetTierCacheForTests());

  it('returns 400 INVALID_UUID on a malformed messageId', async () => {
    const r = await handleUpdateAdvisorReaction(
      makeReq({ method: 'PATCH', params: { messageId: 'bad' }, body: { reaction: 'like' } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('INVALID_UUID');
  });

  it('returns 400 when reaction is not like/dislike/null', async () => {
    const r = await handleUpdateAdvisorReaction(
      makeReq({ method: 'PATCH', params: { messageId: MESSAGE_ID }, body: { reaction: 'love' } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(400);
  });

  it('returns 404 when the message belongs to someone else', async () => {
    const client = makeSupabaseDouble({ selectMaybeSingle: { advisor_messages: { data: { session_id: SESSION_ID, user_id: USER_B }, error: null } } });
    const r = await handleUpdateAdvisorReaction(
      makeReq({ method: 'PATCH', params: { messageId: MESSAGE_ID }, body: { reaction: 'like' } }),
      client,
    );
    expect(r.status).toBe(404);
  });

  it('accepts an explicit null reaction', async () => {
    const client = makeSupabaseDouble({ selectMaybeSingle: { advisor_messages: { data: { session_id: SESSION_ID, user_id: USER_A }, error: null } } });
    const r = await handleUpdateAdvisorReaction(
      makeReq({ method: 'PATCH', params: { messageId: MESSAGE_ID }, body: { reaction: null } }),
      client,
    );
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true });
  });
});

describe('advisor module — handleAdvisorChatStream', () => {
  beforeEach(() => __resetTierCacheForTests());

  it('returns 401 when unauthenticated', async () => {
    const r = await handleAdvisorChatStream(makeReq({ user: null }), makeSupabaseDouble());
    expect(r.status).toBe(401);
    expect(r.stream).toBeUndefined();
  });

  it('returns 402 for a free-tier caller before touching the AI', async () => {
    const client = makeSupabaseDouble({ usersRow: freeRow });
    const r = await handleAdvisorChatStream(
      makeReq({ body: { sessionId: SESSION_ID, message: 'hi' } }),
      client,
    );
    expect(r.status).toBe(402);
  });

  it('returns 400 when the message is missing or blank', async () => {
    const r = await handleAdvisorChatStream(
      makeReq({ body: { sessionId: SESSION_ID, message: '   ' } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(400);
  });

  it('returns 400 INVALID_UUID for a bad sessionId', async () => {
    const r = await handleAdvisorChatStream(
      makeReq({ body: { sessionId: 'bad', message: 'hi' } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('INVALID_UUID');
  });

  it('returns 404 when the session is not owned by the caller', async () => {
    const client = makeSupabaseDouble({ selectMaybeSingle: { advisor_sessions: { data: { user_id: USER_B }, error: null } } });
    const r = await handleAdvisorChatStream(
      makeReq({ body: { sessionId: SESSION_ID, message: 'hi' } }),
      client,
    );
    expect(r.status).toBe(404);
  });

  it('exposes a cancel hook alongside the stream contract on the happy path', async () => {
    const client = makeSupabaseDouble({ selectMaybeSingle: { advisor_sessions: { data: { user_id: USER_A }, error: null } } });
    const r = await handleAdvisorChatStream(
      makeReq({ body: { sessionId: SESSION_ID, message: 'hi' } }),
      client,
    );
    expect(r.status).toBe(200);
    expect(typeof r.cancel).toBe('function');
    expect(r.stream).toBeDefined();
    // The generator must be drainable without throwing (the upstream mock
    // rejects, which the handler converts into a friendly SSE error frame).
    const frames: string[] = [];
    for await (const chunk of r.stream!) frames.push(chunk);
    expect(frames.join('')).toContain('data: [DONE]');
    r.cancel!();
  });
});
