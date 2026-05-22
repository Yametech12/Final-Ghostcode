/// <reference lib="dom" />
/**
 * Framework-agnostic route handlers shared by:
 *  - api/index.ts (Express dev server)
 *  - api/_server.ts (Vercel serverless handler)
 *
 * Each handler takes a normalized request and returns a normalized response,
 * so adding/changing logic only happens in one place.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createCompletion, DEFAULT_MODEL, VISION_MODEL } from '../_config.js';
import { isValidUUID } from './auth.js';

export interface NormalizedRequest {
  method: string;
  body: any;
  query: Record<string, any>;
  params: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  /** Authenticated Supabase user (resolved upstream from Authorization header). May be null. */
  user: User | null;
}

export interface NormalizedResponse {
  status: number;
  body?: any;
  /** SSE stream — when set, body is ignored and the caller streams via this iterable. */
  stream?: AsyncIterable<string>;
}

const REGOLO_BASE_URL = 'https://api.regolo.ai/v1/chat/completions';

function unauthorized(): NormalizedResponse {
  return { status: 401, body: { error: 'Authentication required', code: 'UNAUTHORIZED' } };
}

function badRequest(message: string, code = 'BAD_REQUEST'): NormalizedResponse {
  return { status: 400, body: { error: message, code } };
}

function serverError(message = 'Internal error', code = 'INTERNAL_ERROR'): NormalizedResponse {
  return { status: 500, body: { error: message, code } };
}

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
    email: typeof email === 'string' ? email.slice(0, 100) : undefined,
    ip: typeof ip === 'string' ? ip.slice(0, 45) : undefined,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 200) : undefined,
    timestamp: timestamp || new Date().toISOString(),
    details: detailsStr.length <= 2000 ? details : undefined,
    platform: process.env.NODE_ENV || 'unknown',
  };
  console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
  return { status: 200, body: { success: true, logged: true } };
}

/**
 * POST /api/upload/profile-photo — authenticated.
 * userId is ALWAYS derived from the JWT, never from the body. This prevents a
 * client from claiming someone else's userId and overwriting their photo path.
 */
export async function handleUploadProfilePhoto(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const userId = req.user.id;

  const { base64Data } = req.body || {};
  if (!base64Data || typeof base64Data !== 'string') {
    return badRequest('Image data is required', 'MISSING_IMAGE_DATA');
  }

  const match = base64Data.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
  if (!match) {
    return badRequest('Invalid image data format', 'INVALID_IMAGE_FORMAT');
  }
  const mimeSubtype = match[1].toLowerCase();
  const base64 = match[2];

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) throw new Error('Empty buffer');
  } catch {
    return badRequest('Failed to process image data', 'BUFFER_ERROR');
  }

  // 1MB cap
  if (buffer.length > 1024 * 1024) {
    return { status: 413, body: { error: 'Image too large', code: 'FILE_TOO_LARGE', maxSize: '1024KB' } };
  }

  // Magic-byte sniff: confirm the buffer matches the claimed format. Defends against
  // a client labeling an arbitrary blob as image/* to abuse storage.
  const sniffedMime = sniffImageMime(buffer);
  if (!sniffedMime) {
    return badRequest('Uploaded data is not a recognized image format', 'INVALID_IMAGE_BYTES');
  }
  // Use the sniffed type, not the client-claimed one.
  const ext = sniffedMime.split('/')[1] || 'jpg';
  void mimeSubtype; // accepted but not trusted

  const fileName = `users/${userId}/profile-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('user-uploads')
    .upload(fileName, buffer, { contentType: sniffedMime });

  if (error) {
    console.error('Supabase upload error:', error);
    return serverError('Storage upload failed', 'STORAGE_ERROR');
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('user-uploads').getPublicUrl(fileName);

  return { status: 200, body: { success: true, url: publicUrl, fileName } };
}

function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // GIF: GIF87a or GIF89a
  if (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a') return 'image/gif';
  // WEBP: RIFF....WEBP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
/**
 * POST /api/advisor/session — authenticated.
 */
export async function handleCreateAdvisorSession(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const userId = req.user.id;
  const title = (req.body?.title as string) || 'AI Advisor Session';

  const { data: session, error } = await supabase
    .from('advisor_sessions')
    .insert({
      user_id: userId,
      title,
      timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Session creation error:', error);
    return serverError('Failed to create session');
  }
  return { status: 200, body: { sessionId: session.id } };
}

/**
 * GET /api/advisor/session — authenticated.
 * Returns the latest session and its messages for the authenticated user only.
 */
export async function handleGetAdvisorSession(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const userId = req.user.id;

  const { data: session } = await supabase
    .from('advisor_sessions')
    .select('id, title, timestamp')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return { status: 200, body: { sessionId: null, messages: [] } };
  }

  const { data: messages, error: messagesError } = await supabase
    .from('advisor_messages')
    .select('id, role, content, timestamp')
    .eq('session_id', session.id)
    .order('timestamp', { ascending: true })
    .limit(50);

  if (messagesError) {
    console.error('Messages fetch error:', messagesError);
    return serverError('Failed to fetch messages');
  }

  return { status: 200, body: { sessionId: session.id, messages: messages || [] } };
}

/**
 * DELETE /api/advisor/session/:sessionId — authenticated.
 */
export async function handleDeleteAdvisorSession(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const sessionId = req.params.sessionId;
  if (!isValidUUID(sessionId)) return badRequest('Invalid sessionId', 'INVALID_UUID');

  // Confirm ownership before deleting.
  const { data: session } = await supabase
    .from('advisor_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session || session.user_id !== req.user.id) {
    return { status: 404, body: { error: 'Session not found', code: 'NOT_FOUND' } };
  }

  await supabase.from('advisor_messages').delete().eq('session_id', sessionId);
  await supabase.from('advisor_sessions').delete().eq('id', sessionId);
  return { status: 200, body: { success: true } };
}

/**
 * Build the system prompt + message history for the advisor.
 * Extracted so both streaming (Express) and non-streaming (Vercel) paths share it.
 * Implements token-aware truncation to stay within model context limits.
 */
async function buildAdvisorMessages(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  message: string
): Promise<Array<{ role: string; content: string }>> {
  const [{ data: calibrations }, { data: history }, { data: recentActivity }] = await Promise.all([
    supabase
      .from('calibrations')
      .select('traits, type_id')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(3),
    supabase
      .from('advisor_messages')
      .select('role, content, timestamp')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true })
      .limit(50),
    supabase
      .from('advisor_sessions')
      .select('title, timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(5),
  ]);

  const latestCalibration = calibrations?.[0];
  const personalityType = latestCalibration?.type_id || 'Unknown';
  const traits = latestCalibration?.traits || {};

  const systemPrompt = `You are Epimetheus, a relationship intelligence advisor.
Your goal is to help users navigate interpersonal dynamics with empathy, psychological insight, and practical advice.
- Never be generic; ask clarifying questions when needed.
- Use attachment theory, communication frameworks (NVC), and emotional intelligence concepts.
- Keep responses warm but professional, max 3 paragraphs.
- If the user mentions a specific person ("she/her"), infer possible intentions based on behavior patterns, but avoid assumptions.

## USER PROFILE
Personality Type: ${personalityType}
Traits Analysis: ${traits ? JSON.stringify(traits, null, 2) : 'Not yet calibrated'}

## CONVERSATION CONTEXT
Recent Sessions: ${recentActivity?.map((s) => s.title).join(', ') || 'None'}
Message History: ${history?.length || 0} messages in this session

## RESPONSE GUIDELINES
- Keep responses under 250 words
- Include 1-2 specific, actionable steps when giving advice
- Ask thoughtful questions to deepen understanding
- Reference user's calibration data when relevant
- End with a forward-looking suggestion or question
- Maintain professional, insightful tone`;

  // Token-aware truncation: approximate 1 token ≈ 4 chars.
  // Reserve ~2000 tokens for system prompt + new user message + response.
  // Llama 3.3 70B has 8192 context; leave room for the response (600 tokens max).
  const MAX_HISTORY_CHARS = 20000; // ~5000 tokens for history
  let historyMessages = (history || []).map((m) => ({
    role: m.role === 'model' ? 'assistant' : m.role,
    content: m.content,
  }));

  // Trim oldest messages if total exceeds budget
  let totalChars = historyMessages.reduce((sum, m) => sum + m.content.length, 0);
  while (totalChars > MAX_HISTORY_CHARS && historyMessages.length > 2) {
    const removed = historyMessages.shift();
    if (removed) totalChars -= removed.content.length;
  }

  return [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: message },
  ];
}

/**
 * POST /api/advisor/chat (streaming variant) — authenticated.
 * Returns an SSE stream the caller pipes to the response.
 */
export async function handleAdvisorChatStream(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const userId = req.user.id;
  const { sessionId, message } = req.body || {};

  if (!message?.trim()) return badRequest('Message is required');
  if (!isValidUUID(sessionId)) return badRequest('Invalid sessionId', 'INVALID_UUID');

  // Confirm ownership of the session.
  const { data: sess } = await supabase
    .from('advisor_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (!sess || sess.user_id !== userId) {
    return { status: 404, body: { error: 'Session not found', code: 'NOT_FOUND' } };
  }

  const messages = await buildAdvisorMessages(supabase, userId, sessionId, message);

  // Save user message first, before streaming.
  await supabase.from('advisor_messages').insert({
    session_id: sessionId,
    user_id: userId,
    role: 'user',
    content: message,
  });

  const stream = (async function* (): AsyncGenerator<string> {
    let fullContent = '';
    try {
      const sourceStream = (await createCompletion({
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 600,
        stream: true,
      })) as ReadableStream;

      const reader = sourceStream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;
      const maxChunks = 500;

      try {
        while (chunkCount++ < maxChunks) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          while (true) {
            const lineEnd = buffer.indexOf('\n\n');
            if (lineEnd === -1) break;
            const line = buffer.slice(0, lineEnd);
            buffer = buffer.slice(lineEnd + 2);

            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  yield `data: ${JSON.stringify({ content })}\n\n`;
                }
                if (parsed.choices?.[0]?.finish_reason) {
                  chunkCount = maxChunks;
                  break;
                }
              } catch {
                // skip invalid chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      yield `data: [DONE]\n\n`;
    } catch (streamError: any) {
      const errMsg: string = streamError?.message || '';
      const errorMessage = errMsg.includes('401')
        ? 'AI service authentication failed. Check your Regolo API key.'
        : errMsg.includes('429')
          ? 'AI service is rate-limited. Try again in a moment.'
          : errMsg.includes('insufficient')
            ? 'AI service has insufficient credits. Top up your Regolo account.'
            : "I'm having trouble connecting right now. Please try again in a moment.";
      fullContent = errorMessage;
      yield `data: ${JSON.stringify({ content: errorMessage })}\n\n`;
      yield `data: [DONE]\n\n`;
    }

    // Persist the assistant reply (best-effort, do not block the stream consumer).
    try {
      await supabase.from('advisor_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role: 'model',
        content: fullContent,
      });
      await supabase
        .from('advisor_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    } catch (dbError) {
      console.error('Failed to save chat history:', dbError);
    }
  })();

  return { status: 200, stream };
}

/**
 * POST /api/advisor/chat (non-streaming, for serverless) — authenticated.
 */
export async function handleAdvisorChatBlocking(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const userId = req.user.id;
  const { sessionId, message } = req.body || {};

  if (!message?.trim()) return badRequest('Message is required');
  if (!isValidUUID(sessionId)) return badRequest('Invalid sessionId', 'INVALID_UUID');

  const { data: sess } = await supabase
    .from('advisor_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (!sess || sess.user_id !== userId) {
    return { status: 404, body: { error: 'Session not found', code: 'NOT_FOUND' } };
  }

  const messages = await buildAdvisorMessages(supabase, userId, sessionId, message);

  await supabase.from('advisor_messages').insert({
    session_id: sessionId,
    user_id: userId,
    role: 'user',
    content: message,
  });

  try {
    const completion: any = await createCompletion({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 600,
      stream: false,
    });

    const fullContent: string =
      completion?.choices?.[0]?.message?.content ||
      "I'm having trouble connecting right now. Please try again.";

    await supabase.from('advisor_messages').insert({
      session_id: sessionId,
      user_id: userId,
      role: 'model',
      content: fullContent,
    });
    await supabase
      .from('advisor_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return { status: 200, body: { content: fullContent } };
  } catch (err) {
    console.error('Advisor chat error:', err);
    return serverError('AI service unavailable');
  }
}

/**
 * POST /api/calibration/analyze — authenticated.
 */
export async function handleCalibrationAnalyze(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const userId = req.user.id;
  const { typeId, answers } = req.body || {};

  if (!typeId || !answers) return badRequest('Missing required fields');

  const prompt = `You are a personality analysis system. Based on the following answers to a "${typeId}" calibration, extract a JSON object with:
- 5 primary traits (each with name and score 0-100)
- 3 archetypes (e.g., "The Strategist", "The Empath")
- A short summary (2 sentences)

Answers: ${JSON.stringify(answers)}

Return ONLY valid JSON:
{
  "traits": [{"name": "Openness", "score": 78}],
  "archetypes": ["...", "...", "..."],
  "summary": "..."
}`;

  try {
    const completion: any = await createCompletion({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    });

    const content = completion?.choices?.[0]?.message?.content;
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return serverError('AI returned invalid analysis format', 'AI_PARSE_ERROR');
    }

    // Validate shape and cap string lengths.
    if (!Array.isArray(parsed.traits) || !Array.isArray(parsed.archetypes) || typeof parsed.summary !== 'string') {
      return serverError('AI returned invalid analysis structure', 'AI_SHAPE_ERROR');
    }
    parsed.summary = String(parsed.summary).slice(0, 1000);
    parsed.archetypes = parsed.archetypes.slice(0, 5).map((a: any) => String(a).slice(0, 200));
    parsed.traits = parsed.traits.slice(0, 10).map((t: any) => ({
      name: String(t?.name || 'Unknown').slice(0, 100),
      score: Math.max(0, Math.min(100, Number(t?.score) || 0)),
    }));

    const { data, error } = await supabase
      .from('calibrations')
      .insert({
        user_id: userId,
        type_id: typeId,
        answers,
        traits: parsed,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return { status: 200, body: { success: true, calibration: data, traits: parsed } };
  } catch (err) {
    console.error('Calibration analysis error:', err);
    return serverError(
      'Failed to analyze calibration',
      'CALIBRATION_ERROR'
    );
  }
}

/**
 * POST /api/ai/chat — authenticated.
 * Generic Regolo proxy used by the various analysis pages.
 */
export async function handleAiChat(req: NormalizedRequest): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();

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
    const response = await fetch(REGOLO_BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

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
    console.error('AI chat error:', err);
    return serverError('Chat request failed');
  }
}
