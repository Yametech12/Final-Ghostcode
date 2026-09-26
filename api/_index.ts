/// <reference lib="dom" />
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
// P0-5: gzip/brotli for API responses. Node's http server previously sent
// every JSON payload (some are large — oracle analyses embed a full result
// object) and every static asset uncompressed.
import compression from 'compression';
import { createClient } from '@supabase/supabase-js';


import { getAuthenticatedUser } from './lib/auth.js';
import { log, requestIdFrom, serializeErr } from './lib/log.js';
import { initSentryNode, captureException } from './lib/sentryNode.js';
import { applyCorsHeaders, applySecurityHeaders } from './lib/http.js';
import { cache, cacheMode, tryRedisRateLimit, redisAvailable } from './lib/cache.js';
import {
  handleHealth,
  handleTestKey,
  handleSecurityLog,
  handleUploadProfilePhoto,
  handleCreateAdvisorSession,
  handleGetAdvisorSession,
  handleDeleteAdvisorSession,
  handleUpdateAdvisorReaction,
  handleAdvisorChatStream,
  handleAiChat,
  handleCreateOracleAnalysis,
  handleUpdateOracleAnalysisTasks,
  handleDeleteOracleAnalysis,
  handleDeleteMyAccount,
  handleAdminDeleteUser,
  handleGetMyProfilePhotoUrl,
  handleAdminGetUserPhotoUrl,
  handleAdminUpdateUserRole,
  type NormalizedRequest,
} from './lib/handlers.js';
import {
  handleCreateCheckoutSession,
  handleCreatePortalSession,
  handleStripeWebhook,
} from './lib/subscription.js';
import {
  handleRagReindex,
  handleRagStatus,
  handleRagToggle,
} from './lib/handlers/rag.js';

console.log('Server starting...');
console.log(
  cacheMode === "redis"
    ? "Cache mode: redis (Upstash REST)\n"
    : "Cache mode: process-local \u2014 set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for a shared cache\n",
);

// Initialize Sentry as early as possible so any throw during module
// evaluation gets captured. No-op when SENTRY_DSN isn't set.
void initSentryNode();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware
app.use(helmet());

// ---------------------------------------------------------------------------
// Stripe webhook — MUST be registered BEFORE express.json so signature
// verification sees the RAW request body (re-serialization breaks the HMAC).
// Exempt from JWT auth (Stripe signs the payload itself) and from the CSRF
// check below (Stripe cannot send our custom headers). Registered ahead of
// the body parsers, so none of them consume the stream first.
// ---------------------------------------------------------------------------
app.post(
  '/api/billing/webhook',
  express.raw({ type: '*/*', limit: '1mb' }),
  async (req, res) => {
    const r = await handleStripeWebhook(
      req.body as Buffer | string | undefined,
      req.headers['stripe-signature'] as string | undefined,
      supabase,
    );
    res.status(r.status).json(r.body ?? {});
  },
);

// P0-5: response compression. The filter matters: /api/advisor/chat is a
// text/event-stream and compressing it would let zlib buffer tokens, adding
// latency to time-to-first-token and defeating the point of streaming. So we
// compress everything except SSE, and skip payloads under 1 KB where the
// gzip header overhead outweighs the saving.
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      const contentType = res.getHeader('Content-Type')?.toString() ?? '';
      if (contentType.includes('text/event-stream')) return false;
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  }),
);

// Body parsing with size limits
// Body parsing with size limits (audit H-7/M-8: 10mb was far too permissive).
// The profile-photo upload carries a base64 data-URL, so it gets a scoped 6mb
// parser mounted BEFORE the global one — Express parses on the first matching
// parser, so a global 1mb limit would 413 the upload before the route-scoped
// limit could ever apply. Everything else is capped at 1mb.
app.use('/api/upload/profile-photo', express.json({ limit: '6mb' }));
app.use('/api/upload/profile-photo', express.urlencoded({ extended: true, limit: '6mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Supabase client for backend operations
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('VITE_SUPABASE_URL not found in environment variables. Check your .env file.');
  process.exit(1);
}
if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment variables. Check your .env file.');
  process.exit(1);
}

// Detect placeholder values that were never replaced
const PLACEHOLDERS = ['your_', 'YOUR_', 'placeholder', 'example', 'changeme'];
const isPlaceholder = (val: string) => PLACEHOLDERS.some((p) => val.includes(p));
if (isPlaceholder(supabaseServiceKey)) {
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY is still a placeholder value. Replace it with your real Supabase service role key from: https://supabase.com/dashboard/project/_/settings/api'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Warm the cache client once so a bad Upstash credential surfaces at boot
// instead of on the first gated request. A failure here is non-fatal: the
// cache layer degrades to its bounded process-local store.
if (redisAvailable) {
  void cache
    .set("__boot_probe__", Date.now(), 10)
    .then(() => console.log("Cache: Upstash reachable"))
    .catch((err) => console.warn("Cache: Upstash probe failed, using process-local fallback", err));
}

// ---------------------------------------------------------------------------
// Rate limiting — shared Redis counter (see docs/architecture/caching.md)
//
// The counter lives in Upstash Redis so every instance and region shares one
// bucket. A per-process Map gave each concurrent instance its own allowance,
// which multiplied the effective limit by the number of warm functions.
//
// Degradation is explicit, never fail-open: when Redis is unreachable the cache
// layer falls back to a bounded process-local counter that STILL enforces these
// limits (per instance). See api/lib/cache.ts §4.
// ---------------------------------------------------------------------------
const AI_LIMIT = 10;
const LOG_LIMIT = 30; // /api/security/log is public, so it gets its own bucket
const ACCOUNT_DELETE_LIMIT = 3; // Destructive — keep tight. Matches Vercel.
const RATE_WINDOW_S = 60;
const ACCOUNT_DELETE_WINDOW_S = 5 * 60;

// Bounded fallback store — hard-capped, and expired entries are swept on write.
const FALLBACK_MAX_KEYS = 5_000;
const fallbackStore = new Map<string, { count: number; resetTime: number }>();

function fallbackRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (fallbackStore.size >= FALLBACK_MAX_KEYS) {
    for (const [k, v] of fallbackStore) {
      if (v.resetTime <= now) fallbackStore.delete(k);
    }
    if (fallbackStore.size >= FALLBACK_MAX_KEYS) {
      const oldest = fallbackStore.keys().next().value;
      if (oldest !== undefined) fallbackStore.delete(oldest);
    }
  }
  const rec = fallbackStore.get(key);
  if (!rec || now > rec.resetTime) {
    fallbackStore.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }
  rec.count += 1;
  return rec.count > limit;
}

async function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Decide which bucket (if any) applies. AI/advisor/calibration share one,
  // /api/security/log gets its own with a higher allowance since legitimate
  // clients can emit several events per page load. Account deletion gets
  // its own much tighter bucket since it's destructive and must match the
  // Vercel-side gate (otherwise dev/self-host would have a wider hole than
  // production).
  const isAiPath = req.path.startsWith('/api/ai') || req.path.startsWith('/api/advisor') || req.path.startsWith('/api/calibration');
  const isLogPath = req.path === '/api/security/log';
  const isAccountDelete = req.method === 'DELETE' && req.path === '/api/users/me';
  if (!isAiPath && !isLogPath && !isAccountDelete) return next();

  let limit: number;
  let windowSeconds: number;
  let bucketPrefix: string;
  if (isAccountDelete) {
    limit = ACCOUNT_DELETE_LIMIT;
    windowSeconds = ACCOUNT_DELETE_WINDOW_S;
    bucketPrefix = 'delete';
  } else if (isLogPath) {
    limit = LOG_LIMIT;
    windowSeconds = RATE_WINDOW_S;
    bucketPrefix = 'log';
  } else {
    limit = AI_LIMIT;
    windowSeconds = RATE_WINDOW_S;
    bucketPrefix = 'rate';
  }
  const ip = (req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown').toString();
  const bucketKey = `rate:${bucketPrefix}:${ip}`;
  const { allowed, resetMs } = await tryRedisRateLimit(bucketKey, limit, windowSeconds);

  if (!allowed) {
    return res.status(429).json({
      error: 'Rate limited',
      details: `Maximum ${limit} requests per ${Math.round(windowSeconds / 60)} minute(s)`,
      retryAfter: Math.max(1, Math.ceil(resetMs / 1000)),
      code: 'RATE_LIMITED',
    });
  }
  next();
}
app.use(rateLimitMiddleware);

// ---------------------------------------------------------------------------
// Security & CORS headers — both delegate to the shared helpers in
// lib/http.ts so dev and prod stamp identical headers (especially CSP,
// which previously only existed on this Express path).
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  applySecurityHeaders({
    setHeader: (n, v) => res.setHeader(n, v),
    isSecure: !!req.secure,
  });
  next();
});

app.use((req, res, next) => {
  applyCorsHeaders({
    origin: req.headers.origin,
    setHeader: (n, v) => res.header(n, v),
  });
  next();
});

app.options('/', (_req, res) => res.status(204).end());

// ---------------------------------------------------------------------------
// API versioning: /api/v1/* is rewritten to /api/* for forward compatibility.
// This lets clients optionally pin to v1 without us having to duplicate routes.
// Must run BEFORE the CSRF check so /api/v1/security/log gets the same
// public-endpoint exemption as /api/security/log.
// ---------------------------------------------------------------------------
app.use((req, _res, next) => {
  if (req.url.startsWith('/api/v1/')) {
    req.url = '/api/' + req.url.slice('/api/v1/'.length);
  }
  next();
});

// ---------------------------------------------------------------------------
// CSRF protection: state-changing requests must include Content-Type: application/json
// or X-Requested-With header. Browsers won't send these in cross-origin form submissions.
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (req.path === '/api/security/log') return next(); // Public logging endpoint

  const hasCustomHeader = req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                          req.headers['content-type']?.includes('application/json');
  if (!hasCustomHeader) {
    return res.status(403).json({ error: 'Forbidden: missing required headers', code: 'CSRF_CHECK_FAILED' });
  }
  next();
});

// ---------------------------------------------------------------------------
// Helper: build NormalizedRequest from express.Request
// ---------------------------------------------------------------------------
async function normalize(req: express.Request): Promise<NormalizedRequest> {
  const user = await getAuthenticatedUser(req.headers.authorization, supabase);
  return {
    method: req.method,
    body: req.body,
    query: req.query as Record<string, any>,
    params: req.params as Record<string, string>,
    headers: req.headers as Record<string, string | string[] | undefined>,
    user,
  };
}

async function send(res: express.Response, normReq: NormalizedRequest, handler: (n: NormalizedRequest) => Promise<any>) {
  try {
    const result = await handler(normReq);
    if (result.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.status(result.status);

      // Wire client-disconnect → handler cancellation so we stop reading
      // (and stop billing) the upstream when the user closes their tab.
      const onClose = () => {
        if (typeof result.cancel === 'function') {
          try { result.cancel(); } catch { /* ignore */ }
        }
      };
      res.req.once('close', onClose);

      try {
        for await (const chunk of result.stream) {
          if (res.destroyed) break;
          try {
            res.write(chunk);
          } catch {
            // EPIPE etc — client gone, bail.
            break;
          }
        }
      } finally {
        res.req.off('close', onClose);
      }
      if (!res.destroyed) res.end();
      return;
    }
    res.status(result.status).json(result.body ?? {});
  } catch (err) {
    const requestId = requestIdFrom(res.req.headers as Record<string, string | string[] | undefined>);
    const route = `${res.req.method} ${res.req.path}`;
    log.error('handler_unhandled', {
      requestId,
      route,
      userId: normReq.user?.id,
      err: serializeErr(err),
      _skipSentry: true,
    });
    captureException(err, { requestId, route, userId: normReq.user?.id });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal error', requestId: requestId.slice(-12) });
    }
  }
}

// ---------------------------------------------------------------------------
// Routes — mounted from the declarative table exported by
// api/lib/handlers/index.ts, one entry per domain module.
//
// Behaviour is identical to the 16 hand-written app.get/post/patch/delete
// registrations this replaces:
//   • the array is concatenated in the ORIGINAL registration order, and
//     Express matches in registration order, so first-match semantics are
//     unchanged;
//   • every non-static route still runs normalize() (JWT resolution) then
//     send() (SSE plumbing + the 500 fallback that logs to Sentry);
//   • the one static route (/api/ai/credits) still answers WITHOUT touching
//     Supabase or the auth header, exactly as the previous inline handler did.
// ---------------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, handleHealth);
});

app.get('/api/ai/test-key', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, handleTestKey);
});

app.get('/api/ai/credits', (_req, res) => {
  res.status(404).json({ error: 'Credits endpoint not available for Regolo AI' });
});

app.post('/api/security/log', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, handleSecurityLog);
});

app.post('/api/upload/profile-photo', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleUploadProfilePhoto(nr, supabase));
});

// Signed-URL read path for the now-private user-uploads bucket.
// See 20240101001000_storage_private_bucket.sql.
app.get('/api/me/profile-photo', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleGetMyProfilePhotoUrl(nr, supabase));
});

app.get('/api/admin/users/:id/photo', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleAdminGetUserPhotoUrl(nr, supabase));
});

// Privileged write moved off the client: the column-level grants in
// 20240101000900 reject users.update({role}) from the browser with 42501.
app.patch('/api/admin/users/:id/role', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleAdminUpdateUserRole(nr, supabase));
});

app.post('/api/advisor/session', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleCreateAdvisorSession(nr, supabase));
});

app.get('/api/advisor/session', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleGetAdvisorSession(nr, supabase));
});

app.delete('/api/advisor/session/:sessionId', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleDeleteAdvisorSession(nr, supabase));
});

for (const route of routes) {
  const verb = route.method.toLowerCase() as ExpressVerb;

  if (isStaticRoute(route)) {
    app[verb](route.path, (_req, res) => {
      res.status(route.staticResponse.status).json(route.staticResponse.body);
    });
    continue;
  }

// Billing — Stripe checkout & customer portal (JWT required; CSRF applies via
// the JSON content-type the client always sends).
app.post('/api/billing/create-checkout-session', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleCreateCheckoutSession(nr, supabase));
});

app.post('/api/billing/create-portal-session', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleCreatePortalSession(nr, supabase));
});

// RAG management. Registered in the same explicit style as every other route
// in this file (this baseline has no route loop). All three are authenticated
// and soft-fail with HTTP 200 + { ok: false } on operational errors, so a
// missing migration or embedding outage never breaks the advisor.
app.post('/api/rag/reindex', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleRagReindex(nr, supabase));
});

app.post('/api/rag/toggle', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleRagToggle(nr, supabase));
});

app.get('/api/rag/status', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleRagStatus(nr, supabase));
});

// Self-serve account deletion. Body: { confirm: "<email>" }. Cascades
// through public.users → all child tables, and the storage trigger
// handles the bucket files.
app.delete('/api/users/me', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleDeleteMyAccount(nr, supabase));
});

// Machine-readable route table, used by scripts/route-table-modules.ts to
// diff the mounted surface against the pre-refactor registration list.
export const routeTable: string[] = routes.map((r) => `${r.method} ${r.path}`);

// Static serving (production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// Generic error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = requestIdFrom(_req.headers as Record<string, string | string[] | undefined>);
  const route = `${_req.method} ${_req.path}`;
  log.error('express_unhandled', {
    requestId,
    route,
    err: serializeErr(err),
    _skipSentry: true,
  });
  // Direct capture in addition to the log forwarder so the unhandled
  // path still has explicit Sentry coverage even if the forwarder import
  // hasn't resolved yet on the first error of a cold start.
  captureException(err, { requestId, route });
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { details: serializeErr(err) }),
  });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
