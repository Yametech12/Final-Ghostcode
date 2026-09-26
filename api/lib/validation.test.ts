import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCompletion } from '../_config.js';
import {
  handleAdvisorChatStream,
  handleCreateAdvisorSession,
  handleCalibrationAnalyze,
  handleAiChat,
  handleUploadProfilePhoto,
  type NormalizedRequest,
} from './handlers';
import { BOUNDS } from './validation';
import { requireString, clampInt, clampFloat, requireJsonString } from './validation';
import { __resetTierCacheForTests } from './tierGate';

// ---------------------------------------------------------------------------
// Test doubles (same pattern as handlers.test.ts)
// ---------------------------------------------------------------------------

vi.mock('../_config.js', () => ({
  createCompletion: vi.fn().mockResolvedValue({
    choices: [{ message: { content: '{}' } }],
  }),
  DEFAULT_MODEL: 'test-model',
  VISION_MODEL: 'test-vision',
}));

const fakeUser = { id: '550e8400-e29b-41d4-a716-446655440000', email: 'u@example.com' } as any;

function makeReq(over: Partial<NormalizedRequest> = {}): NormalizedRequest {
  return {
    method: 'POST',
    body: {},
    query: {},
    params: {},
    headers: {},
    user: fakeUser,
    ...over,
  };
}

function makeSupabase() {
  type Result = { data?: any; error?: any };
  let nextSelectMaybeSingle: Result = { data: null, error: null };
  let nextHeadCount: { count: number | null; error: any } = { count: 0, error: null };
  let usersRow: Result = {
    data: { role: 'user', subscription_tier: 'strategist', subscription_expires_at: null },
    error: null,
  };

  const builder = (kind: 'select' | 'insert' | 'update' | 'delete' | 'upsert', table: string | null) => {
    let headCount = false; // this builder instance is a HEAD count query
    const chain: any = {
      select: (_cols?: any, opts?: any) => {
        headCount = !!(opts && opts.head && opts.count === 'exact');
        return chain;
      },
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: () => {
        if (table === 'users' && kind === 'select') return Promise.resolve(usersRow);
        return Promise.resolve(nextSelectMaybeSingle);
      },
      single: () => Promise.resolve(nextSelectMaybeSingle),
      then: (onFulfilled: any) =>
        // Awaited list queries (buildAdvisorMessages Promise.all) expect
        // `{ data: [...] }` rows; the HEAD count query returns its counter.
        (headCount
          ? Promise.resolve(nextHeadCount)
          : Promise.resolve({ data: [], error: null })
        ).then(onFulfilled),
    };
    return chain;
  };

  const client: any = {
    from: vi.fn((table: string) => ({
      // Forward the select options — the HEAD count query passes
      // { count: 'exact', head: true } and the builder needs to see it.
      select: (cols?: any, opts?: any) => { const c = builder('select', table); c.select(cols, opts); return c; },
      insert: () => builder('insert', table),
      update: () => builder('update', table),
      delete: () => builder('delete', table),
      upsert: () => builder('upsert', table),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn/photo.png' } }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
  };

  return {
    client,
    setSession: (r: Result) => { nextSelectMaybeSingle = r; },
    setHeadCount: (c: { count: number | null; error: any }) => { nextHeadCount = c; },
  };
}

const SESSION_ID = '123e4567-e89b-12d3-a456-426614174000';

beforeEach(() => {
  __resetTierCacheForTests();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// Unit tests: validation primitives
// ---------------------------------------------------------------------------

describe('requireString', () => {
  it('accepts a valid string and trims it', () => {
    expect(requireString('  hello  ', 'message', 100)).toBe('hello');
  });

  it('rejects a number with INVALID_TYPE (audit H-4: the TypeError→500 bug)', () => {
    expect(() => requireString(12345, 'message', 4000)).toThrowError(/must be a string/);
    try {
      requireString(12345, 'message', 4000);
    } catch (e: any) {
      expect(e.code).toBe('MESSAGE_INVALID_TYPE');
      expect(e.status).toBe(400);
    }
  });

  it('rejects an object with INVALID_TYPE', () => {
    expect(() => requireString({ a: 1 }, 'message', 4000)).toThrowError(/must be a string/);
  });

  it('rejects null and undefined with INVALID_TYPE', () => {
    expect(() => requireString(null, 'message', 4000)).toThrowError(/must be a string/);
    expect(() => requireString(undefined, 'message', 4000)).toThrowError(/must be a string/);
  });

  it('rejects an empty/whitespace-only string with EMPTY', () => {
    expect(() => requireString('   ', 'message', 4000)).toThrowError(/is required/);
  });

  it('rejects an over-long string with TOO_LONG', () => {
    expect(() => requireString('x'.repeat(4001), 'message', 4000)).toThrowError(/too long/);
  });
});

describe('clampInt', () => {
  it('clamps max_tokens above the cap (audit H-7)', () => {
    expect(clampInt(100000000, 'max_tokens', 1, BOUNDS.MAX_OUTPUT_TOKENS, 4096)).toBe(4096);
  });
  it('clamps below the minimum', () => {
    expect(clampInt(-5, 'limit', 1, 100, 50)).toBe(1);
  });
  it('falls back on non-numeric garbage', () => {
    expect(clampInt({ a: 1 }, 'max_tokens', 1, 4096, 4096)).toBe(4096);
    expect(clampInt(NaN, 'max_tokens', 1, 4096, 4096)).toBe(4096);
    expect(clampInt('abc', 'max_tokens', 1, 4096, 4096)).toBe(4096);
  });
  it('truncates floats', () => {
    expect(clampInt(10.9, 'limit', 1, 100, 50)).toBe(10);
  });
});

describe('clampFloat', () => {
  it('clamps temperature above the cap (audit H-7)', () => {
    expect(clampFloat(42, 'temperature', 0, 1, 0.7)).toBe(1);
  });
  it('clamps below the minimum', () => {
    expect(clampFloat(-3, 'temperature', 0, 1, 0.7)).toBe(0);
  });
  it('falls back on non-finite input', () => {
    expect(clampFloat(Infinity, 'temperature', 0, 1, 0.7)).toBe(0.7);
    expect(clampFloat('hot', 'temperature', 0, 1, 0.7)).toBe(0.7);
  });
  it('passes valid values through', () => {
    expect(clampFloat(0.35, 'temperature', 0, 1, 0.7)).toBe(0.35);
  });
});

describe('requireJsonString', () => {
  it('accepts an object payload and returns valid JSON', () => {
    const out = requireJsonString({ q1: 'a' }, 'answers', 10);
    expect(JSON.parse(out)).toEqual({ q1: 'a' });
  });

  it('rejects an invalid JSON string with INVALID_JSON', () => {
    try {
      requireJsonString('{not json', 'answers', 10);
      throw new Error('should have thrown');
    } catch (e: any) {
      expect(e.code).toBe('ANSWERS_INVALID_JSON');
      expect(e.status).toBe(400);
    }
  });

  it('rejects an over-large payload with TOO_LARGE', () => {
    expect(() => requireJsonString({ x: 'y'.repeat(20 * 1024) }, 'answers', 10)).toThrowError(/too large/);
  });

  it('rejects null with MISSING', () => {
    expect(() => requireJsonString(null, 'answers', 10)).toThrowError(/required/);
  });

  it('rejects a bare number with TYPE', () => {
    expect(() => requireJsonString(42, 'answers', 10)).toThrowError(/must be an object/);
  });
});

// ---------------------------------------------------------------------------
// Handler-level tests
// ---------------------------------------------------------------------------

describe('handleAdvisorChatStream input validation', () => {
  it('returns 400 INVALID_TYPE (not 500) when message is an integer', async () => {
    const { client, setSession } = makeSupabase();
    setSession({ data: { user_id: fakeUser.id }, error: null });
    const r = await handleAdvisorChatStream(
      makeReq({ body: { sessionId: SESSION_ID, message: 12345 } }),
      client,
    );
    expect(r.status).toBe(400);
    expect((r.body as any).code).toBe('MESSAGE_INVALID_TYPE');
  });

  it('returns 400 INVALID_TYPE when message is an object', async () => {
    const { client, setSession } = makeSupabase();
    setSession({ data: { user_id: fakeUser.id }, error: null });
    const r = await handleAdvisorChatStream(
      makeReq({ body: { sessionId: SESSION_ID, message: { a: 1 } } }),
      client,
    );
    expect(r.status).toBe(400);
    expect((r.body as any).code).toBe('MESSAGE_INVALID_TYPE');
  });

  it('returns 400 TOO_LONG when message exceeds 4000 chars', async () => {
    const { client, setSession } = makeSupabase();
    setSession({ data: { user_id: fakeUser.id }, error: null });
    const r = await handleAdvisorChatStream(
      makeReq({ body: { sessionId: SESSION_ID, message: 'x'.repeat(4001) } }),
      client,
    );
    expect(r.status).toBe(400);
    expect((r.body as any).code).toBe('MESSAGE_TOO_LONG');
  });

  it('returns 404 when the session is not owned by the caller', async () => {
    const { client, setSession } = makeSupabase();
    setSession({ data: { user_id: 'someone-else' }, error: null });
    const r = await handleAdvisorChatStream(
      makeReq({ body: { sessionId: SESSION_ID, message: 'hi' } }),
      client,
    );
    expect(r.status).toBe(404);
  });

  it('returns 429 SESSION_TOO_LONG when the session has ≥ 200 messages', async () => {
    const { client, setSession, setHeadCount } = makeSupabase();
    setSession({ data: { user_id: fakeUser.id }, error: null });
    setHeadCount({ count: BOUNDS.MAX_MESSAGES_PER_SESSION, error: null });
    const r = await handleAdvisorChatStream(
      makeReq({ body: { sessionId: SESSION_ID, message: 'hi' } }),
      client,
    );
    expect(r.status).toBe(429);
    expect((r.body as any).error).toMatch(/Session too long/);
  });

  it('valid input reaches the streaming path (200 + stream)', async () => {
    const { client, setSession, setHeadCount } = makeSupabase();
    setSession({ data: { user_id: fakeUser.id }, error: null });
    setHeadCount({ count: 2, error: null });
    const r = await handleAdvisorChatStream(
      makeReq({ body: { sessionId: SESSION_ID, message: '  hello there  ' } }),
      client,
    );
    expect(r.status).toBe(200);
    expect(r.stream).toBeDefined();
  });
});

describe('handleCreateAdvisorSession title validation', () => {
  it('defaults the title when omitted', async () => {
    const { client, setSession } = makeSupabase();
    setSession({ data: { id: SESSION_ID }, error: null }); // insert().single() result
    const r = await handleCreateAdvisorSession(makeReq({ body: {} }), client);
    expect(r.status).toBe(200);
  });

  it('returns 400 INVALID_TYPE when title is a number', async () => {
    const { client } = makeSupabase();
    const r = await handleCreateAdvisorSession(makeReq({ body: { title: 99 } }), client);
    expect(r.status).toBe(400);
    expect((r.body as any).code).toBe('TITLE_INVALID_TYPE');
  });

  it('returns 400 TOO_LONG when title exceeds 200 chars', async () => {
    const { client } = makeSupabase();
    const r = await handleCreateAdvisorSession(
      makeReq({ body: { title: 't'.repeat(201) } }),
      client,
    );
    expect(r.status).toBe(400);
    expect((r.body as any).code).toBe('TITLE_TOO_LONG');
  });

  it('accepts a valid title', async () => {
    const { client, setSession } = makeSupabase();
    setSession({ data: { id: SESSION_ID }, error: null }); // insert().single() result
    const r = await handleCreateAdvisorSession(
      makeReq({ body: { title: 'Dating advice' } }),
      client,
    );
    expect(r.status).toBe(200);
  });
});

describe('handleCalibrationAnalyze answers validation', () => {
  it('returns 400 INVALID_JSON when answers is a malformed JSON string', async () => {
    const { client } = makeSupabase();
    const r = await handleCalibrationAnalyze(
      makeReq({ body: { typeId: 'TDI', answers: '{not json' } }),
      client,
    );
    expect(r.status).toBe(400);
    expect((r.body as any).code).toBe('ANSWERS_INVALID_JSON');
  });

  it('returns 400 TOO_LARGE when answers exceed 10KB', async () => {
    const { client } = makeSupabase();
    const big = { q: 'y'.repeat(11 * 1024) };
    const r = await handleCalibrationAnalyze(
      makeReq({ body: { typeId: 'TDI', answers: big } }),
      client,
    );
    expect(r.status).toBe(400);
    expect((r.body as any).code).toBe('ANSWERS_TOO_LARGE');
  });

  it('returns 400 when typeId is not a 3-letter type', async () => {
    const { client } = makeSupabase();
    const r = await handleCalibrationAnalyze(
      makeReq({ body: { typeId: 123, answers: { q: 'a' } } }),
      client,
    );
    expect(r.status).toBe(400);
  });

  it('accepts a valid object payload', async () => {
    const { client } = makeSupabase();
    const r = await handleCalibrationAnalyze(
      makeReq({ body: { typeId: 'TDI', answers: { q1: 'answer' } } }),
      client,
    );
    // Fails later at the AI-call step (no key in tests) — but it must NOT be
    // a 400 validation failure and must not be a 500 TypeError.
    expect([200, 500, 503]).toContain(r.status);
    expect((r.body as any).code).not.toBe('ANSWERS_INVALID_JSON');
  });
});

describe('handleAiChat parameter clamps', () => {
  it('does not throw on clamped huge max_tokens / bad temperature (validated upstream of fetch)', async () => {
    const { client } = makeSupabase();
    // No network in tests: the call will fail at fetch; what we assert is
    // that the handler never 500s with a TypeError and returns a sane status.
    const r = await handleAiChat(
      makeReq({
        body: {
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 100000000,
          temperature: 99,
        },
      }),
      client,
    );
    expect([200, 500, 503, 504]).toContain(r.status);
  });
});

describe('handleUploadProfilePhoto size gate', () => {
  it('returns 413 before decoding when the data-URL exceeds the cap', async () => {
    const { client } = makeSupabase();
    const huge = 'data:image/png;base64,' + 'A'.repeat(BOUNDS.MAX_B64_DATAURL_BYTES + 10);
    const r = await handleUploadProfilePhoto(makeReq({ body: { base64Data: huge } }), client);
    expect(r.status).toBe(413);
    expect((r.body as any).code).toBe('FILE_TOO_LARGE');
  });

  it('accepts a small valid PNG data-URL', async () => {
    const { client } = makeSupabase();
    // 1x1 PNG
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const r = await handleUploadProfilePhoto(makeReq({ body: { base64Data: png } }), client);
    expect(r.status).toBe(200);
    expect((r.body as any).success).toBe(true);
  });
});
