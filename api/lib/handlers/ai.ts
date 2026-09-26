/// <reference lib="dom" />
/**
 * Generic AI proxy domain.
 *
 * Verbatim from api/lib/handlers.ts: handleAiChat (lines 1055-1205), including
 * the REGOLO_BASE_URL constant (line 37) it uses.
 *
 * The double tier gate (strategist, then oracle only when an image is present),
 * the 30-message / 100 KB caps, the 55 s AbortSignal budget and every upstream
 * status mapping (400/401/429/502/503) are unchanged.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_MODEL, VISION_MODEL } from '../../_config.js';
import { requireTier } from '../tierGate.js';
import { log, serializeErr } from '../log.js';
import { badRequest, serverError, unauthorized } from '../response.js';
import type { NormalizedRequest, NormalizedResponse, RouteDef } from '../types.js';

const REGOLO_BASE_URL = 'https://api.regolo.ai/v1/chat/completions';

/**
 * POST /api/ai/chat — authenticated.
 * Generic Regolo proxy used by the various analysis pages.
 */
export async function handleAiChat(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();

  // Tier gate. Every page that calls /api/ai/chat (Decryptor, Simulation,
  // CalibrationPage Oracle) is Strategist-tier or higher in the React
  // route guard, so the API needs to enforce the same. Otherwise a free
  // user could hit this endpoint directly with curl + their JWT.
  const denied = await requireTier(req, supabase, 'strategist');
  if (denied) return denied;

  const apiKey = process.env.REGOLO_API_KEY;
  if (!apiKey) return serverError('API key not configured', 'NO_API_KEY');

  const { messages, model, temperature, max_tokens, stream } = req.body || {};

  // Input validation: prevent abuse via oversized payloads
  if (!Array.isArray(messages) || messages.length === 0) {
    return badRequest('messages must be a non-empty array');
  }
  if (messages.length > 30) {
    return badRequest('Too many messages (max 30)');
  }
  const totalContentLength = messages.reduce((sum: number, m: any) => {
    const content = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content || '');
    return sum + content.length;
  }, 0);
  if (totalContentLength > 100_000) {
    return badRequest('Total message content too large (max 100KB)');
  }

  const hasImage = (messages || []).some((m: any) => {
    if (!m?.content) return false;
    if (typeof m.content === 'string') {
      return m.content.includes('data:image') || m.content.includes('base64');
    }
    if (Array.isArray(m.content)) return m.content.some((c: any) => c.type === 'image_url');
    return false;
  });

  // Image attachments are an Oracle-tier feature (matches PricingPage).
  // We already passed the strategist gate above; this second gate runs
  // only when the request actually carries an image, so non-image
  // requests on Strategist still go through normally.
  if (hasImage) {
    const oracleDenied = await requireTier(req, supabase, 'oracle');
    if (oracleDenied) {
      return {
        status: oracleDenied.status,
        body: {
          ...oracleDenied.body,
          error: 'Image attachments require the Oracle plan',
          feature: 'image_attachments',
        },
      };
    }
  }

  const effectiveModel = hasImage ? VISION_MODEL : model || DEFAULT_MODEL;

  const requestBody: any = {
    model: effectiveModel,
    messages: messages || [],
    temperature: temperature ?? 0.7,
    max_tokens: max_tokens ?? 4096,
    stream: !!stream,
  };

  if (hasImage) {
    requestBody.messages = messages.map((m: any) => {
      if (!m.content || typeof m.content !== 'string') return m;
      const base64Match = m.content.match(/data:image\/(\w+);base64,/);
      if (base64Match) {
        return {
          role: m.role,
          content: [
            { type: 'text', text: m.content.replace(/data:image\/(\w+);base64,[\w+/=]+/, '').trim() },
            { type: 'image_url', image_url: { url: m.content } },
          ],
        };
      }
      return m;
    });
  }

  try {
    // Hard timeout on the upstream call so a hung Regolo connection can't
    // burn the entire Vercel function budget. AbortSignal.timeout is the
    // modern path; fall back to a manual AbortController if unavailable.
    //
    // Vercel function cap = 60s (vercel.json). Give Regolo up to 55s
    // for Oracle calibration prompts which are large structured JSON.
    const TIMEOUT_MS = 55_000;
    const signal: AbortSignal =
      typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(TIMEOUT_MS)
        : (() => {
            const c = new AbortController();
            setTimeout(() => c.abort(), TIMEOUT_MS);
            return c.signal;
          })();

    let response: Response;
    try {
      response = await fetch(REGOLO_BASE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal,
      });
    } catch (fetchErr: any) {
      if (fetchErr?.name === 'AbortError' || fetchErr?.name === 'TimeoutError') {
        return { status: 504, body: { error: 'AI service timed out', code: 'AI_TIMEOUT' } };
      }
      throw fetchErr;
    }

    const status = response.status;
    const responseText = await response.text();
    let parsed: any = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // leave as empty object
    }

    if (status === 400) return badRequest(parsed?.error?.message || 'Bad request');
    if (status === 401) return { status: 500, body: { error: 'AI service temporarily unavailable', code: 'AI_SERVICE_ERROR' } };
    if (status === 429) return { status: 429, body: { error: 'Rate limited', code: 'RATE_LIMITED', retryAfter: response.headers.get('Retry-After') } };
    if (status === 502 || status === 503) {
      return { status: 503, body: { error: 'Model unavailable', code: 'MODEL_UNAVAILABLE' } };
    }
    if (!response.ok) {
      return serverError(parsed?.error?.message || `Request failed (${status})`);
    }

    return { status: 200, body: parsed };
  } catch (err) {
    log.error('ai_chat_failed', { userId: req.user?.id, err: serializeErr(err) });
    return serverError('Chat request failed');
  }
}

export const routes: RouteDef[] = [
  {
    method: 'POST',
    path: '/api/ai/chat',
    auth: 'authenticated',
    handler: (req, supabase) => handleAiChat(req, supabase),
  },
];
