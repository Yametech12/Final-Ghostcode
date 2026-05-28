/// <reference lib="dom" />
import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

import { getAuthenticatedUser } from './lib/auth.js';
import { log, requestIdFrom, serializeErr } from './lib/log.js';
import {
  initSentryNode,
  captureException,
  flush as sentryFlush,
} from './lib/sentryNode.js';
import { applyCorsHeaders, applySecurityHeaders } from './lib/http.js';
import {
  handleHealth,
  handleTestKey,
  handleSecurityLog,
  handleUploadProfilePhoto,
  handleCreateAdvisorSession,
  handleGetAdvisorSession,
  handleDeleteAdvisorSession,
  handleAdvisorChatStream,
  handleAiChat,
  handleCreateOracleAnalysis,
  handleUpdateOracleAnalysisTasks,
  handleDeleteOracleAnalysis,
  handleDeleteMyAccount,
  handleAdminDeleteUser,
  type NormalizedRequest,
} from './lib/handlers.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Initialize server-side Sentry once per cold start. No-op when
// SENTRY_DSN isn't configured. Module-load init means even a throw
// during the first request's setup is captured.
//
// Rationale: kick off the import here (so warm functions skip it) but
// expose a Promise the handler can await on the cold path only, so a
// cold-start crash inside the handler still reaches Sentry. We track
// resolution with a flag so warm requests skip the microtask hop that
// `await` would otherwise force on every invocation.
let sentryReadyResolved = false;
const sentryReady: Promise<void> = initSentryNode().finally(() => {
  sentryReadyResolved = true;
});

/**
 * Stamp every response with the same security + CORS headers Express
 * applies in dev. Routes through the shared helpers in lib/http.ts so
 * dev and prod can't drift again — the previous Vercel handler shipped
 * NO Content-Security-Policy in production, only X-Frame-Options /
 * X-Content-Type-Options / X-XSS-Protection.
 */
function applyResponseHeaders(req: VercelRequest, res: VercelResponse) {
  const setHeader = (name: string, value: string) => res.setHeader(name, value);
  applyCorsHeaders({ origin: req.headers.origin as string | undefined, setHeader });
  applySecurityHeaders({ setHeader });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Cold path: wait for Sentry to finish initializing before any logic
  // that might throw, otherwise a cold-start crash never reaches the
  // dashboard. Warm path: the flag is already true so we skip the
  // microtask hop entirely. This shaves a couple of microseconds off
  // every warm request and avoids forcing the V8 microtask queue to
  // flush a no-op promise.
  if (!sentryReadyResolved) {
    await sentryReady;
  }

  applyResponseHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!supabase) {
    res.status(500).json({ error: 'Database not configured' });
    return;
  }

  // Derive pathname from URL (req.query.path may not be set depending on rewrite mode)
  const url = req.url || '';
  // Strip query string, the /api/ prefix, and optional /v1 version prefix.
  // Supports both /api/health and /api/v1/health for forward compatibility.
  const pathFromUrl = url.split('?')[0]
    .replace(/^\/api\/?/, '')
    .replace(/^v1\//, '');
  const pathFromQuery = Array.isArray(req.query.path) ? req.query.path.join('/') : (req.query.path as string | undefined);
  const pathname = (pathFromUrl || pathFromQuery || '').replace(/^v1\//, '');

  // Rate limiting for AI/advisor/calibration endpoints, the public
  // /api/security/log path, and self-serve account deletion. The latter
  // has been seen abused via stolen JWTs to enumerate users by timing
  // the CONFIRM_REQUIRED vs CONFIRM_MISMATCH responses, so it gets a
  // tight bucket on top of the auth-token check the handler does.
  const isAiPath = pathname.startsWith('ai/') || pathname.startsWith('advisor/') || pathname.startsWith('calibration/');
  const isLogPath = pathname === 'security/log';
  const isAccountDelete = pathname === 'users/me' && req.method === 'DELETE';
  if (isAiPath || isLogPath || isAccountDelete) {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
    // Tight bucket for account deletion (3/min/IP) — legitimate use is
    // 1 invocation per user, ever. The log endpoint stays at 30/min
    // because page loads emit several events. AI/advisor stays at 15.
    const RATE_LIMIT = isAccountDelete ? 3 : isLogPath ? 30 : 15;
    const RATE_WINDOW_S = 60;
    const rateLimitKey = isAccountDelete
      ? `delete:${clientIp}`
      : isLogPath
        ? `log:${clientIp}`
        : `rate:${clientIp}`;

    try {
      // Atomic insert-and-count via RPC. Two concurrent callers cannot both
      // see count<limit; the second's INSERT serializes after the first's,
      // so one of them is guaranteed to see count>=limit and be rejected.
      const { data: count, error: rpcErr } = await supabase.rpc(
        'record_and_count_rate_limit',
        { rl_key: rateLimitKey, window_seconds: RATE_WINDOW_S }
      );

      if (rpcErr) {
        // RPC missing or query failed — fall back to allowing the request so
        // a deploy without the migration doesn't break the app.
        log.warn('rate_limit_rpc_failed', {
          rateLimitKey,
          err: serializeErr(rpcErr),
        });
      } else if (typeof count === 'number' && count > RATE_LIMIT) {
        res.status(429).json({
          error: 'Rate limited',
          code: 'RATE_LIMITED',
          retryAfter: RATE_WINDOW_S,
        });
        return;
      }
    } catch (rateLimitErr) {
      log.warn('rate_limit_check_failed', { err: serializeErr(rateLimitErr) });
    }
  }

  const user = await getAuthenticatedUser(req.headers.authorization, supabase);

  // Note: we deliberately do NOT call Sentry.setUser() here. setUser
  // mutates the global hub scope, which is shared across all concurrent
  // invocations on a warm function. Two interleaved requests would see
  // each other's userId on errors. captureException / captureFromLog
  // both attach userId via withScope per-call, which is the safe path.

  // Per-user rate limit (additional guard on top of per-IP). A single
  // authenticated user shouldn't be able to burn the shared per-IP quota
  // for everyone behind the same NAT; a per-user bucket also makes abuse
  // by a single account expensive instead of socializing it.
  if (user && isAiPath) {
    const PER_USER_LIMIT = 30; // requests per minute per user across AI endpoints
    const PER_USER_WINDOW_S = 60;
    try {
      const { data: userCount, error: rpcErr } = await supabase.rpc(
        'record_and_count_rate_limit',
        { rl_key: `user:${user.id}`, window_seconds: PER_USER_WINDOW_S },
      );
      if (!rpcErr && typeof userCount === 'number' && userCount > PER_USER_LIMIT) {
        res.status(429).json({
          error: 'Rate limited (per user)',
          code: 'USER_RATE_LIMITED',
          retryAfter: PER_USER_WINDOW_S,
        });
        return;
      }
    } catch (e) {
      log.warn('per_user_rate_limit_check_failed', {
        userId: user?.id,
        err: serializeErr(e),
      });
    }
  }

  // CSRF protection: state-changing requests must include a custom header.
  // Browsers won't send custom headers in cross-origin form submissions or simple requests.
  if (req.method !== 'GET' && req.method !== 'HEAD' && pathname !== 'security/log') {
    const hasCustomHeader = req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                            req.headers['content-type']?.includes('application/json');
    if (!hasCustomHeader) {
      res.status(403).json({ error: 'Forbidden: missing required headers', code: 'CSRF_CHECK_FAILED' });
      return;
    }
  }

  const normReq: NormalizedRequest = {
    method: req.method || 'GET',
    body: req.body,
    query: req.query as Record<string, any>,
    params: {},
    headers: req.headers as Record<string, string | string[] | undefined>,
    user,
  };

  try {
    // Public routes
    if ((pathname === 'health' || pathname === '') && req.method === 'GET') {
      const r = await handleHealth();
      res.status(r.status).json(r.body);
      return;
    }
    if (pathname === 'ai/test-key' && req.method === 'GET') {
      const r = await handleTestKey();
      res.status(r.status).json(r.body);
      return;
    }
    if (pathname === 'ai/credits') {
      res.status(404).json({ error: 'Credits endpoint not available for Regolo AI' });
      return;
    }
    if (pathname === 'security/log' && req.method === 'POST') {
      const r = await handleSecurityLog(normReq);
      res.status(r.status).json(r.body);
      return;
    }

    // Authenticated routes
    if (pathname === 'ai/chat' && req.method === 'POST') {
      const r = await handleAiChat(normReq, supabase);
      res.status(r.status).json(r.body);
      return;
    }
    if (pathname === 'upload/profile-photo' && req.method === 'POST') {
      const r = await handleUploadProfilePhoto(normReq, supabase);
      res.status(r.status).json(r.body);
      return;
    }
    if (pathname === 'advisor/session' && req.method === 'POST') {
      const r = await handleCreateAdvisorSession(normReq, supabase);
      res.status(r.status).json(r.body);
      return;
    }
    if (pathname === 'advisor/session' && req.method === 'GET') {
      const r = await handleGetAdvisorSession(normReq, supabase);
      res.status(r.status).json(r.body);
      return;
    }
    if (pathname.startsWith('advisor/session/') && req.method === 'DELETE') {
      normReq.params = { sessionId: pathname.split('/')[2] };
      const r = await handleDeleteAdvisorSession(normReq, supabase);
      res.status(r.status).json(r.body);
      return;
    }
    if (pathname === 'advisor/chat' && req.method === 'POST') {
      // Vercel serverless supports streaming via the runtime, but to keep this
      // handler simple and broadly compatible we use the streaming variant and
      // pipe it to the response.
      const r = await handleAdvisorChatStream(normReq, supabase);
      if (r.stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.status(r.status);

        // Vercel's underlying Node response emits 'close' when the client
        // hangs up. Wire that to the handler's cancel hook so we stop
        // consuming Regolo tokens for an audience that's gone.
        const onClose = () => {
          if (typeof r.cancel === 'function') {
            try { r.cancel(); } catch { /* ignore */ }
          }
        };
        res.once('close', onClose);

        try {
          for await (const chunk of r.stream) {
            if ((res as any).destroyed) break;
            try {
              res.write(chunk);
            } catch {
              break;
            }
          }
        } finally {
          res.off('close', onClose);
        }
        res.end();
        return;
      }
      res.status(r.status).json(r.body);
      return;
    }
    if (pathname === 'oracle/analyses' && req.method === 'POST') {
      const r = await handleCreateOracleAnalysis(normReq, supabase);
      res.status(r.status).json(r.body);
      return;
    }
    // PATCH /api/oracle/analyses/:id/tasks  → server-validated task replace
    if (pathname.startsWith('oracle/analyses/') && pathname.endsWith('/tasks') && req.method === 'PATCH') {
      const segments = pathname.split('/');
      // segments: ['oracle', 'analyses', '<id>', 'tasks']
      if (segments.length === 4) {
        normReq.params = { id: segments[2] };
        const r = await handleUpdateOracleAnalysisTasks(normReq, supabase);
        res.status(r.status).json(r.body);
        return;
      }
    }
    // DELETE /api/oracle/analyses/:id  → owner-only delete
    if (pathname.startsWith('oracle/analyses/') && req.method === 'DELETE') {
      const segments = pathname.split('/');
      if (segments.length === 3) {
        normReq.params = { id: segments[2] };
        const r = await handleDeleteOracleAnalysis(normReq, supabase);
        res.status(r.status).json(r.body);
        return;
      }
    }

    // DELETE /api/users/me  → self-serve account deletion
    if (pathname === 'users/me' && req.method === 'DELETE') {
      const r = await handleDeleteMyAccount(normReq, supabase);
      res.status(r.status).json(r.body);
      return;
    }

    // DELETE /api/admin/users/:id  → admin-only user deletion
    if (pathname.startsWith('admin/users/') && req.method === 'DELETE') {
      const segments = pathname.split('/');
      // segments: ['admin', 'users', '<id>']
      if (segments.length === 3) {
        normReq.params = { id: segments[2] };
        const r = await handleAdminDeleteUser(normReq, supabase);
        res.status(r.status).json(r.body);
        return;
      }
    }

    res.status(404).json({ error: 'Not found', path: pathname });
  } catch (err) {
    const requestId = requestIdFrom(req.headers as Record<string, string | string[] | undefined>);
    const route = `${req.method} ${pathname}`;
    // _skipSentry: the explicit captureException() right below already
    // sends the real stack to Sentry. Auto-forwarding the log line would
    // produce a second, synthetic event that Sentry doesn't dedupe
    // against the explicit one — doubling our quota burn for no gain.
    log.error('vercel_handler_unhandled', {
      requestId,
      route,
      userId: user?.id,
      err: serializeErr(err),
      _skipSentry: true,
    });
    captureException(err, { requestId, route, userId: user?.id });
    // Vercel freezes the function process as soon as the response ends,
    // which can drop the just-captured event. Flush before returning so
    // the error reaches Sentry. 2s is a sane budget given the 30s
    // function timeout.
    await sentryFlush(2000);
    // Surface the requestId to the client so users reporting bugs to
    // support can quote a short correlation handle. We slice to the
    // last 8 chars to keep it copy-pasteable without leaking platform
    // request-id semantics.
    res.status(500).json({
      error: 'Internal error',
      requestId: requestId.slice(-12),
    });
  }
}
