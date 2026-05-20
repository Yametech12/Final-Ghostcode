/// <reference lib="dom" />
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import { createClient } from '@supabase/supabase-js';

import { serializeError } from '../src/utils/errorHandling';
import { getAuthenticatedUser } from './lib/auth.js';
import {
  handleHealth,
  handleTestKey,
  handleSecurityLog,
  handleUploadProfilePhoto,
  handleCreateAdvisorSession,
  handleGetAdvisorSession,
  handleDeleteAdvisorSession,
  handleAdvisorChatStream,
  handleCalibrationAnalyze,
  handleAiChat,
  type NormalizedRequest,
} from './lib/handlers.js';

console.log('Server starting...');

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
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.path.startsWith('/api/ai') && !req.path.startsWith('/api/advisor')) return next();

  const ip = (req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown').toString();
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return next();
  }
  if (record.count >= RATE_LIMIT) {
    return res.status(429).json({
      error: 'Rate limited',
      details: `Maximum ${RATE_LIMIT} requests per minute`,
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    });
  }
  record.count++;
  next();
}
app.use(rateLimitMiddleware);

// ---------------------------------------------------------------------------
// Security & CORS headers
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Tightened CSP — removed 'unsafe-inline' from script-src.
  // Keeping 'unsafe-inline' on style-src because Tailwind 4 inlines critical CSS;
  // when you migrate to nonce-based styling, drop it.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "script-src 'self' https://www.google.com https://www.gstatic.com; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https://*.supabase.co https://*.upstash.com https://api.regolo.ai https://*.anthropic.com https://*.openai.com https://*.google.com; " +
      "font-src 'self' data:; " +
      "object-src 'none'; " +
      "frame-ancestors 'self'; " +
      "base-uri 'self';"
  );
  if (req.secure || process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'https://epimetheusproject.vercel.app',
        'https://epimetheus.ai',
        'https://www.epimetheus.ai',
      ];

  // Echo only the requesting origin if it's in the allow-list.
  // Never use '*' alongside Allow-Credentials: true (browsers reject the combo).
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

app.options('/', (_req, res) => res.status(204).end());

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
      for await (const chunk of result.stream) {
        if (res.destroyed) break;
        res.write(chunk);
      }
      if (!res.destroyed) res.end();
      return;
    }
    res.status(result.status).json(result.body ?? {});
  } catch (err) {
    console.error('Handler error:', serializeError(err));
    if (!res.headersSent) res.status(500).json({ error: 'Internal error' });
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

app.post('/api/calibration/analyze', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, (nr) => handleCalibrationAnalyze(nr, supabase));
});

app.post('/api/ai/chat', async (req, res) => {
  const n = await normalize(req);
  await send(res, n, handleAiChat);
});

// Static serving (production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// Generic error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', serializeError(err));
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
