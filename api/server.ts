/// <reference lib="dom" />
import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://epimetheusproject.vercel.app',
  'https://epimetheus.ai',
  'https://www.epimetheus.ai',
];

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
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
  // Strip query string and the /api/ prefix
  const pathFromUrl = url.split('?')[0].replace(/^\/api\/?/, '');
  const pathFromQuery = Array.isArray(req.query.path) ? req.query.path.join('/') : (req.query.path as string | undefined);
  const pathname = pathFromUrl || pathFromQuery || '';

  // Rate limiting for AI/advisor endpoints (Supabase-based, persists across cold starts)
  if (pathname.startsWith('ai/') || pathname.startsWith('advisor/') || pathname.startsWith('calibration/')) {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
    const rateLimitKey = `rate:${clientIp}`;
    const RATE_LIMIT = 15; // requests per window
    const RATE_WINDOW_MS = 60_000; // 1 minute

    try {
      // Use a simple approach: check recent requests from this IP in the last minute
      // This uses a lightweight table or falls back to allowing the request
      const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
      const { count } = await supabase
        .from('rate_limits')
        .select('*', { count: 'exact', head: true })
        .eq('key', rateLimitKey)
        .gte('created_at', windowStart);

      if (count !== null && count >= RATE_LIMIT) {
        res.status(429).json({
          error: 'Rate limited',
          code: 'RATE_LIMITED',
          retryAfter: 60,
        });
        return;
      }

      // Record this request (fire and forget)
      supabase.from('rate_limits').insert({ key: rateLimitKey }).then(() => {});
    } catch (rateLimitErr) {
      // If rate_limits table doesn't exist or query fails, allow the request through
      // This makes rate limiting best-effort without breaking the app
      console.warn('Rate limit check failed (table may not exist):', rateLimitErr);
    }
  }

  const user = await getAuthenticatedUser(req.headers.authorization, supabase);

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
      const r = await handleAiChat(normReq);
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
        for await (const chunk of r.stream) {
          res.write(chunk);
        }
        res.end();
        return;
      }
      res.status(r.status).json(r.body);
      return;
    }
    if (pathname === 'calibration/analyze' && req.method === 'POST') {
      const r = await handleCalibrationAnalyze(normReq, supabase);
      res.status(r.status).json(r.body);
      return;
    }

    res.status(404).json({ error: 'Not found', path: pathname });
  } catch (err) {
    console.error('Vercel handler error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
