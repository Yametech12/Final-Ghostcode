import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCreateOracleAnalysis, handleUpdateOracleAnalysisTasks, handleDeleteOracleAnalysis } from '../oracle';
import type { NormalizedRequest } from '../../types';
import { makeSupabaseDouble, USER_A, USER_B, ANALYSIS_ID } from '../../testHelpers/supabaseDouble';
import { __resetTierCacheForTests } from '../../tierGate';

vi.mock('../../../_config.js', () => ({
  DEFAULT_MODEL: 'fake',
  VISION_MODEL: 'fake',
  createCompletion: vi.fn(),
}));

const fakeUser = { id: USER_A, email: 'u@example.com' } as any;

function makeReq(over: Partial<NormalizedRequest> = {}): NormalizedRequest {
  return { method: 'POST', body: {}, query: {}, params: {}, headers: {}, user: fakeUser, ...over };
}

const validResult = {
  primaryType: 'TDI',
  confidence: 80,
  secondaryType: null,
  analysis: 'detail',
  indicators: ['a'],
  tasks: [{
    id: 'task-1', title: 'do it', description: 'now', priority: 'high',
    dueDate: 'today', completed: false, category: 'communication',
  }],
  coldReader: '', howSheGetsWhatSheWants: '', whatToAvoid: [],
  relationshipAdvice: { vision: '', investment: '', potential: '' },
  freakDynamics: { kink: '', threesomes: '', worship: '' },
  darkMindBreakdown: '', behavioralBlueprint: '', interactionStrategy: '',
};

describe('oracle module — handleCreateOracleAnalysis', () => {
  beforeEach(() => {
    __resetTierCacheForTests();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns 401 when unauthenticated', async () => {
    const r = await handleCreateOracleAnalysis(makeReq({ user: null, body: {} }), makeSupabaseDouble());
    expect(r.status).toBe(401);
  });

  it('returns 402 PAYMENT_REQUIRED for a free-tier caller', async () => {
    const client = makeSupabaseDouble({
      usersRow: { role: 'user', subscription_tier: 'free', subscription_expires_at: null },
    });
    const r = await handleCreateOracleAnalysis(
      makeReq({ body: { input: { a: 1 }, result: validResult } }),
      client,
    );
    expect(r.status).toBe(402);
    expect(r.body.requiredTier).toBe('strategist');
    expect(r.body.currentTier).toBe('free');
  });

  it('returns 400 when input is not an object', async () => {
    const r = await handleCreateOracleAnalysis(
      makeReq({ body: { input: 'string', result: validResult } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(400);
  });

  it('returns 400 INVALID_RESULT for an unknown primaryType', async () => {
    const r = await handleCreateOracleAnalysis(
      makeReq({ body: { input: { a: 1 }, result: { ...validResult, primaryType: 'XYZ' } } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('INVALID_RESULT');
  });

  it('returns 400 when result is null', async () => {
    const r = await handleCreateOracleAnalysis(
      makeReq({ body: { input: { a: 1 }, result: null } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(400);
  });

  it('returns 400 when the input blob exceeds 20 KB', async () => {
    const r = await handleCreateOracleAnalysis(
      makeReq({ body: { input: { blob: 'x'.repeat(21_000) }, result: validResult } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(400);
  });

  it('returns 200 with the inserted id on success', async () => {
    const client = makeSupabaseDouble({ insertSingle: { data: { id: ANALYSIS_ID }, error: null } });
    const r = await handleCreateOracleAnalysis(
      makeReq({ body: { input: { a: 1 }, result: validResult } }),
      client,
    );
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(ANALYSIS_ID);
  });

  it('returns 500 DB_INSERT_ERROR when the insert fails', async () => {
    const client = makeSupabaseDouble({ insertSingle: { data: null, error: { message: 'boom' } } });
    const r = await handleCreateOracleAnalysis(
      makeReq({ body: { input: { a: 1 }, result: validResult } }),
      client,
    );
    expect(r.status).toBe(500);
    expect(r.body.code).toBe('DB_INSERT_ERROR');
  });
});

describe('oracle module — handleUpdateOracleAnalysisTasks', () => {
  beforeEach(() => {
    __resetTierCacheForTests();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns 401 when unauthenticated', async () => {
    const r = await handleUpdateOracleAnalysisTasks(makeReq({ user: null }), makeSupabaseDouble());
    expect(r.status).toBe(401);
  });

  it('returns 400 INVALID_UUID on a bad id', async () => {
    const r = await handleUpdateOracleAnalysisTasks(
      makeReq({ params: { id: 'not-a-uuid' }, body: { tasks: [] } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('INVALID_UUID');
  });

  it('returns 400 when tasks is not an array', async () => {
    const r = await handleUpdateOracleAnalysisTasks(
      makeReq({ params: { id: ANALYSIS_ID }, body: { tasks: 'nope' } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(400);
  });

  it('returns 400 above 50 tasks', async () => {
    const r = await handleUpdateOracleAnalysisTasks(
      makeReq({ params: { id: ANALYSIS_ID }, body: { tasks: Array.from({ length: 51 }, () => ({})) } }),
      makeSupabaseDouble(),
    );
    expect(r.status).toBe(400);
  });

  it('returns 404 when the row belongs to someone else', async () => {
    const client = makeSupabaseDouble({ selectMaybeSingle: { oracle_analyses: { data: { user_id: USER_B, result: {} }, error: null } } });
    const r = await handleUpdateOracleAnalysisTasks(
      makeReq({ params: { id: ANALYSIS_ID }, body: { tasks: [] } }),
      client,
    );
    expect(r.status).toBe(404);
  });

  it('returns 200 with the sanitized task list when the caller owns the row', async () => {
    const client = makeSupabaseDouble({
      selectMaybeSingle: { oracle_analyses: { data: { user_id: USER_A, result: { tasks: [] } }, error: null } },
      updateSingle: { data: { id: ANALYSIS_ID }, error: null },
    });
    const r = await handleUpdateOracleAnalysisTasks(
      makeReq({
        params: { id: ANALYSIS_ID },
        body: { tasks: [{
          id: 't1', title: 'do it', description: 'now', priority: 'high',
          dueDate: 'today', completed: false, category: 'communication',
        }] },
      }),
      client,
    );
    expect(r.status).toBe(200);
    expect(r.body.tasks[0].title).toBe('do it');
    expect(r.body.id).toBe(ANALYSIS_ID);
  });

  it('clamps an out-of-range priority/category to the defaults', async () => {
    const client = makeSupabaseDouble({
      selectMaybeSingle: { oracle_analyses: { data: { user_id: USER_A, result: {} }, error: null } },
      updateSingle: { data: { id: ANALYSIS_ID }, error: null },
    });
    const r = await handleUpdateOracleAnalysisTasks(
      makeReq({ params: { id: ANALYSIS_ID }, body: { tasks: [{ id: 't', title: 'x', priority: 'urgent', category: 'magic' }] } }),
      client,
    );
    expect(r.body.tasks[0].priority).toBe('medium');
    expect(r.body.tasks[0].category).toBe('psychology');
  });
});

describe('oracle module — handleDeleteOracleAnalysis', () => {
  beforeEach(() => {
    __resetTierCacheForTests();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns 401 when unauthenticated', async () => {
    const r = await handleDeleteOracleAnalysis(makeReq({ user: null }), makeSupabaseDouble());
    expect(r.status).toBe(401);
  });

  it('returns 400 on a bad id', async () => {
    const r = await handleDeleteOracleAnalysis(makeReq({ params: { id: 'bad' } }), makeSupabaseDouble());
    expect(r.status).toBe(400);
  });

  it('returns 404 when the row belongs to someone else', async () => {
    const client = makeSupabaseDouble({ selectMaybeSingle: { oracle_analyses: { data: { user_id: USER_B }, error: null } } });
    const r = await handleDeleteOracleAnalysis(makeReq({ params: { id: ANALYSIS_ID } }), client);
    expect(r.status).toBe(404);
  });

  it('deletes and returns success when the caller owns the row', async () => {
    const client = makeSupabaseDouble({ selectMaybeSingle: { oracle_analyses: { data: { user_id: USER_A }, error: null } } });
    const r = await handleDeleteOracleAnalysis(makeReq({ params: { id: ANALYSIS_ID } }), client);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true });
  });

  it('does NOT tier-gate the delete (owners can clean up after downgrade)', async () => {
    const client = makeSupabaseDouble({
      usersRow: { role: 'user', subscription_tier: 'free', subscription_expires_at: null },
      selectMaybeSingle: { oracle_analyses: { data: { user_id: USER_A }, error: null } },
    });
    const r = await handleDeleteOracleAnalysis(makeReq({ params: { id: ANALYSIS_ID } }), client);
    expect(r.status).toBe(200);
  });
});
