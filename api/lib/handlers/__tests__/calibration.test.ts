import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCalibrationAnalyze } from '../calibration';
import type { NormalizedRequest } from '../../types';
import { makeSupabaseDouble, USER_A } from '../../testHelpers/supabaseDouble';
import { __resetTierCacheForTests } from '../../tierGate';

vi.mock('../../../_config.js', () => ({
  DEFAULT_MODEL: 'fake',
  VISION_MODEL: 'fake',
  createCompletion: vi.fn(),
}));

import { createCompletion } from '../../../_config.js';

const fakeUser = { id: USER_A, email: 'u@example.com' } as any;

function makeReq(over: Partial<NormalizedRequest> = {}): NormalizedRequest {
  return { method: 'POST', body: {}, query: {}, params: {}, headers: {}, user: fakeUser, ...over };
}

describe('calibration module — handleCalibrationAnalyze', () => {
  beforeEach(() => {
    __resetTierCacheForTests();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns 401 when unauthenticated', async () => {
    const r = await handleCalibrationAnalyze(makeReq({ user: null }), makeSupabaseDouble());
    expect(r.status).toBe(401);
  });

  it('returns 402 PAYMENT_REQUIRED for a free-tier caller', async () => {
    const client = makeSupabaseDouble({
      usersRow: { role: 'user', subscription_tier: 'free', subscription_expires_at: null },
    });
    const r = await handleCalibrationAnalyze(makeReq({ body: { typeId: 'TDI', answers: {} } }), client);
    expect(r.status).toBe(402);
    expect(r.body.currentTier).toBe('free');
  });

  it('returns 400 when typeId or answers is missing', async () => {
    const r = await handleCalibrationAnalyze(makeReq({ body: {} }), makeSupabaseDouble());
    expect(r.status).toBe(400);
  });

  it('clamps oversized AI output and returns 200', async () => {
    const client = makeSupabaseDouble({ insertSingle: { data: { id: 'cal-1' }, error: null } });
    const oversize = 'x'.repeat(5000);
    (createCompletion as any).mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        traits: Array.from({ length: 20 }, () => ({ name: oversize, score: 999 })),
        archetypes: Array.from({ length: 20 }, () => oversize),
        summary: oversize,
      }) } }],
    });

    const r = await handleCalibrationAnalyze(makeReq({ body: { typeId: 'TDI', answers: { q: 'a' } } }), client);
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.traits.summary.length).toBeLessThanOrEqual(1000);
    expect(r.body.traits.archetypes.length).toBeLessThanOrEqual(5);
    expect(r.body.traits.archetypes[0].length).toBeLessThanOrEqual(200);
    expect(r.body.traits.traits.length).toBeLessThanOrEqual(10);
    expect(r.body.traits.traits[0].name.length).toBeLessThanOrEqual(100);
    expect(r.body.traits.traits[0].score).toBeGreaterThanOrEqual(0);
    expect(r.body.traits.traits[0].score).toBeLessThanOrEqual(100);
  });

  it('returns 500 AI_PARSE_ERROR when the model returns non-JSON', async () => {
    const client = makeSupabaseDouble();
    (createCompletion as any).mockResolvedValueOnce({ choices: [{ message: { content: 'not json' } }] });
    const r = await handleCalibrationAnalyze(makeReq({ body: { typeId: 'TDI', answers: { q: 'a' } } }), client);
    expect(r.status).toBe(500);
    expect(r.body.code).toBe('AI_PARSE_ERROR');
  });

  it('returns 500 AI_SHAPE_ERROR when the JSON has the wrong shape', async () => {
    const client = makeSupabaseDouble();
    (createCompletion as any).mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ traits: 'nope', archetypes: [], summary: 'x' }) } }],
    });
    const r = await handleCalibrationAnalyze(makeReq({ body: { typeId: 'TDI', answers: { q: 'a' } } }), client);
    expect(r.status).toBe(500);
    expect(r.body.code).toBe('AI_SHAPE_ERROR');
  });

  it('reports the unserved route explicitly (module exports no routes)', async () => {
    const mod = await import('../calibration');
    expect(mod.routes).toEqual([]);
  });
});
