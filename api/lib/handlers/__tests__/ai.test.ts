import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleAiChat } from '../ai';
import type { NormalizedRequest } from '../../types';
import { makeSupabaseDouble, USER_A } from '../../testHelpers/supabaseDouble';
import { __resetTierCacheForTests } from '../../tierGate';

vi.mock('../../../_config.js', () => ({
  DEFAULT_MODEL: 'fake-model',
  VISION_MODEL: 'fake-vision',
  createCompletion: vi.fn(),
}));

const fakeUser = { id: USER_A, email: 'u@example.com' } as any;

function makeReq(over: Partial<NormalizedRequest> = {}): NormalizedRequest {
  return { method: 'POST', body: {}, query: {}, params: {}, headers: {}, user: fakeUser, ...over };
}

const freeRow = { role: 'user', subscription_tier: 'free', subscription_expires_at: null };

describe('ai module — handleAiChat', () => {
  const originalKey = process.env.REGOLO_API_KEY;

  beforeEach(() => {
    __resetTierCacheForTests();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.REGOLO_API_KEY;
    else process.env.REGOLO_API_KEY = originalKey;
  });

  it('returns 401 when unauthenticated', async () => {
    const r = await handleAiChat(makeReq({ user: null }), makeSupabaseDouble());
    expect(r.status).toBe(401);
  });

  it('returns 402 for a free-tier caller', async () => {
    const client = makeSupabaseDouble({ usersRow: freeRow });
    const r = await handleAiChat(makeReq({ body: { messages: [{ role: 'user', content: 'hi' }] } }), client);
    expect(r.status).toBe(402);
    expect(r.body.code).toBe('PAYMENT_REQUIRED');
  });

  it('returns 500 NO_API_KEY when REGOLO_API_KEY is unset', async () => {
    delete process.env.REGOLO_API_KEY;
    const r = await handleAiChat(makeReq({ body: { messages: [{ role: 'user', content: 'hi' }] } }), makeSupabaseDouble());
    expect(r.status).toBe(500);
    expect(r.body.code).toBe('NO_API_KEY');
  });

  it('returns 400 when messages is not a non-empty array', async () => {
    process.env.REGOLO_API_KEY = 'test-key';
    const r = await handleAiChat(makeReq({ body: { messages: [] } }), makeSupabaseDouble());
    expect(r.status).toBe(400);
  });

  it('returns 400 above 30 messages', async () => {
    process.env.REGOLO_API_KEY = 'test-key';
    const messages = Array.from({ length: 31 }, () => ({ role: 'user', content: 'x' }));
    const r = await handleAiChat(makeReq({ body: { messages } }), makeSupabaseDouble());
    expect(r.status).toBe(400);
  });

  it('returns 400 when total content exceeds 100 KB', async () => {
    process.env.REGOLO_API_KEY = 'test-key';
    const r = await handleAiChat(
      makeReq({ body: { messages: [{ role: 'user', content: 'x'.repeat(100_001) }] } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(400);
  });

  it('requires the Oracle plan when an image is attached', async () => {
    process.env.REGOLO_API_KEY = 'test-key';
    const r = await handleAiChat(
      makeReq({ body: { messages: [{ role: 'user', content: 'data:image/png;base64,AAA what is this' }] } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(402);
    expect(r.body.feature).toBe('image_attachments');
  });

  it('maps an upstream 400 to a 400 with the upstream message', async () => {
    process.env.REGOLO_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'bad model' } }), { status: 400 })));
    const r = await handleAiChat(makeReq({ body: { messages: [{ role: 'user', content: 'hi' }] } }), makeSupabaseDouble());
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('bad model');
    vi.unstubAllGlobals();
  });

  it('maps an upstream 429 to a 429 RATE_LIMITED', async () => {
    process.env.REGOLO_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429, headers: { 'Retry-After': '7' } })));
    const r = await handleAiChat(makeReq({ body: { messages: [{ role: 'user', content: 'hi' }] } }), makeSupabaseDouble());
    expect(r.status).toBe(429);
    expect(r.body.code).toBe('RATE_LIMITED');
    vi.unstubAllGlobals();
  });

  it('maps an upstream 503 to a 503 MODEL_UNAVAILABLE', async () => {
    process.env.REGOLO_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
    const r = await handleAiChat(makeReq({ body: { messages: [{ role: 'user', content: 'hi' }] } }), makeSupabaseDouble());
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('MODEL_UNAVAILABLE');
    vi.unstubAllGlobals();
  });

  it('passes a successful upstream body straight through as 200', async () => {
    process.env.REGOLO_API_KEY = 'test-key';
    const upstream = { choices: [{ message: { content: 'hello' } }] };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(upstream), { status: 200 })));
    const r = await handleAiChat(makeReq({ body: { messages: [{ role: 'user', content: 'hi' }] } }), makeSupabaseDouble());
    expect(r.status).toBe(200);
    expect(r.body).toEqual(upstream);
    vi.unstubAllGlobals();
  });
});
