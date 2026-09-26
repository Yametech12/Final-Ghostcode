/// <reference lib="dom" />
/**
 * Unauthenticated / probe endpoints.
 *
 * Verbatim from api/lib/handlers.ts:
 *   handleHealth         lines 51-66
 *   handleTestKey        lines 68-79
 *   handleSecurityLog    lines 81-116
 *
 * These are grouped together because they are the only endpoints reachable
 * without a JWT (plus the fixed /api/ai/credits 404 that previously lived
 * inline in api/_index.ts line 268-270 and api/server.ts line 214-217).
 */
import type { NormalizedRequest, NormalizedResponse, RouteDef } from '../types.js';
import { log } from '../log.js';
import { badRequest } from '../response.js';

/**
 * GET /api/health — public.
 */
export async function handleHealth(): Promise<NormalizedResponse> {
  const hasKey = !!process.env.REGOLO_API_KEY;
  return {
    status: 200,
    body: {
      status: 'ok',
      env: process.env.NODE_ENV,
      regolo: hasKey,
      aiProvider: 'Regolo AI',
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * GET /api/ai/test-key — public.
 */
export async function handleTestKey(): Promise<NormalizedResponse> {
  const hasKey = !!process.env.REGOLO_API_KEY;
  return {
    status: 200,
    body: hasKey
      ? { configured: true, provider: 'Regolo AI' }
      : { configured: false, error: 'API key not configured' },
  };
}

/**
 * POST /api/security/log — public (best-effort logging).
 * In production this should write to a real log sink. For now, console only.
 * Rate-limited by payload size to prevent abuse.
 */
export async function handleSecurityLog(req: NormalizedRequest): Promise<NormalizedResponse> {
  const { event, userId, email, ip, userAgent, timestamp, details } = req.body || {};
  if (!event || typeof event !== 'string') return badRequest('Event type is required');

  // Limit payload size to prevent log injection / DoS
  if (event.length > 100) return badRequest('Event type too long');
  const detailsStr = details ? JSON.stringify(details) : '';
  if (detailsStr.length > 2000) return badRequest('Details payload too large');

  const logEntry = {
    event: event.slice(0, 100),
    userId: typeof userId === 'string' ? userId.slice(0, 50) : undefined,
    // Redact emails so log sinks (Vercel/Datadog) don't accumulate PII.
    // Keep enough to correlate complaints (first char + domain) without
    // storing the full address.
    email: typeof email === 'string'
      ? email.replace(/^([^@]).*@/, '$1***@').slice(0, 100)
      : undefined,
    ip: typeof ip === 'string' ? ip.slice(0, 45) : undefined,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 200) : undefined,
    timestamp: timestamp || new Date().toISOString(),
    details: detailsStr.length <= 2000 ? details : undefined,
    platform: process.env.NODE_ENV || 'unknown',
  };
  // The legacy console.log("[SECURITY] {...}") shape is preserved as a
  // structured `securityEvent` field so log search keeps working. The
  // top-level `event` field on the log line stays as our internal
  // category marker.
  log.info('security_log', { securityEvent: logEntry.event, payload: logEntry });
  return { status: 200, body: { success: true, logged: true } };
}

export const routes: RouteDef[] = [
  { method: 'GET', path: '/api/health', auth: 'public', handler: () => handleHealth() },
  { method: 'GET', path: '/api/ai/test-key', auth: 'public', handler: () => handleTestKey() },
  {
    method: 'GET',
    path: '/api/ai/credits',
    auth: 'public',
    // Previously an inline handler in api/_index.ts (268-270) and api/server.ts
    // (214-217). Same status, same body, and still skips auth resolution.
    staticResponse: { status: 404, body: { error: 'Credits endpoint not available for Regolo AI' } },
  },
  { method: 'POST', path: '/api/security/log', auth: 'public', handler: (req) => handleSecurityLog(req) },
];
