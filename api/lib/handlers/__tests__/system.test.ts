import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleHealth, handleTestKey, handleSecurityLog } from '../system';
import type { NormalizedRequest } from '../../types';

function makeReq(over: Partial<NormalizedRequest> = {}): NormalizedRequest {
  return { method: 'POST', body: {}, query: {}, params: {}, headers: {}, user: null, ...over };
}

describe('system module — handleHealth', () => {
  const original = process.env.REGOLO_API_KEY;
  beforeEach(() => {
    process.env.REGOLO_API_KEY = original;
  });

  it('reports ok + the Regolo provider shape', async () => {
    process.env.REGOLO_API_KEY = 'test-key';
    const r = await handleHealth();
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
    expect(r.body.aiProvider).toBe('Regolo AI');
    expect(r.body.regolo).toBe(true);
    expect(typeof r.body.timestamp).toBe('string');
  });

  it('reports regolo:false when the key is unset', async () => {
    delete process.env.REGOLO_API_KEY;
    const r = await handleHealth();
    expect(r.status).toBe(200);
    expect(r.body.regolo).toBe(false);
  });
});

describe('system module — handleTestKey', () => {
  it('returns configured:true when the key exists', async () => {
    process.env.REGOLO_API_KEY = 'test-key';
    const r = await handleTestKey();
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ configured: true, provider: 'Regolo AI' });
  });

  it('returns configured:false with an error string when unset', async () => {
    delete process.env.REGOLO_API_KEY;
    const r = await handleTestKey();
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ configured: false, error: 'API key not configured' });
  });
});

describe('system module — handleSecurityLog (public endpoint)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('rejects a missing event', async () => {
    const r = await handleSecurityLog(makeReq({ body: {} }));
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('BAD_REQUEST');
  });

  it('rejects a non-string event', async () => {
    const r = await handleSecurityLog(makeReq({ body: { event: 42 } }));
    expect(r.status).toBe(400);
  });

  it('rejects an event over 100 chars', async () => {
    const r = await handleSecurityLog(makeReq({ body: { event: 'x'.repeat(101) } }));
    expect(r.status).toBe(400);
  });

  it('rejects a details payload over 2000 chars', async () => {
    const r = await handleSecurityLog(makeReq({ body: { event: 'login', details: { b: 'x'.repeat(2500) } } }));
    expect(r.status).toBe(400);
  });

  it('accepts a valid payload and returns the unchanged body shape', async () => {
    const r = await handleSecurityLog(makeReq({ body: { event: 'login', userId: 'u-1' } }));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, logged: true });
  });

  it('redacts the local part of the email', async () => {
    const info = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handleSecurityLog(makeReq({ body: { event: 'login', email: 'someone@example.com' } }));
    const logged = info.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('someone@example.com'.replace(/^([^@]).*@/, '$1***@'));
    expect(logged).not.toContain('someone@example.com');
  });
});
