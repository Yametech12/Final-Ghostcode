/// <reference lib="dom" />
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import { createClient } from '@supabase/supabase-js';

import { serializeError } from '../src/utils/errorHandling';
import { getAuthenticatedUser } from './lib/auth.js';
import { log, requestIdFrom, serializeErr } from './lib/log.js';
import { initSentryNode, captureException } from './lib/sentryNode.js';
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

console.log('Server starting...');

// Initialize Sentry as early as possible so any throw during module
// evaluation gets captured. No-op when SENTRY_DSN isn't set.
void initSentryNode();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware
app.use(helmet());

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// ---------------------------------------------------------------------------
// Rate limiting (in-memory; best-effort only — see notes in shared handlers)
// ---------------------------------------------------------------------------
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const AI_LIMIT = 10;
const LOG_LIMIT = 30; // /api/security/log is public, so it gets its own bucket
const ACCOUNT_DELETE_LIMIT = 3; // Destructive — keep tight. Matches Vercel.
const RATE_WINDOW = 60_000;
const ACCOUNT_DELETE_WINDOW = 5 * 60_000; // 5min window for account delete

function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
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
  let window: number;
  let bucketPrefix: string;
  if (isAccountDelete) {
    limit = ACCOUNT_DELETE_LIMIT;
    window = ACCOUNT_DELETE_WINDOW;
    bucketPrefix = 'acctdel';
  } else if (isLogPath) {
    limit = LOG_LIMIT;
    window = RATE_WINDOW;
    bucketPrefix = 'log';
  } else {
    limit = AI_LIMIT;
    window = RATE_WINDOW;
    bucketPrefix = 'ai';
  }
  const ip = (req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown').toString();
  const bucketKey = `${bucketPrefix}:${ip}`;
  const now = Date.now();
  const record = rateLimitStore.get(bucketKey);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(bucketKey, { count: 1, resetTime: now + window });
    return next();
  }
  if (record.count >= limit) {
    return res.status(429).json({
      error: 'Rate limited',
      details: `Maximum ${limit} requests per ${Math.round(window / 60_000)} minute(s)`,
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
      code: 'RATE_LIMITED',
    });
  }
  record.count++;
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
// Routes
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

app.post('/api/advisor/chat', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleAdvisorChatStream(nr, supabase));
});

app.post('/api/oracle/analyses', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleCreateOracleAnalysis(nr, supabase));
});

app.patch('/api/oracle/analyses/:id/tasks', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleUpdateOracleAnalysisTasks(nr, supabase));
});

app.delete('/api/oracle/analyses/:id', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleDeleteOracleAnalysis(nr, supabase));
});

app.post('/api/ai/chat', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleAiChat(nr, supabase));
});

// Self-serve account deletion. Body: { confirm: "<email>" }. Cascades
// through public.users → all child tables, and the storage trigger
// handles the bucket files.
app.delete('/api/users/me', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleDeleteMyAccount(nr, supabase));
});

// Admin-only user deletion. Required because AdminDashboard previously
// deleted from `public.users` directly, which after the auth FK migration
// leaves the auth row intact (ghost account). This handler verifies the
// caller's admin role server-side and drives the deletion through
// auth.admin.deleteUser so the FK cascade actually fires.
app.delete('/api/admin/users/:id', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleAdminDeleteUser(nr, supabase));
});

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
  // Keep the legacy serializeError for the dev-only `details` payload — it
  // matches the shape clients have come to expect from local dev.
  void serializeError;
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { details: serializeError(err) }),
  });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
