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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

  const { path } = req.query;
  const pathname = Array.isArray(path) ? path.join('/') : path || '';

  const user = await getAuthenticatedUser(req.headers.authorization, supabase);
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
