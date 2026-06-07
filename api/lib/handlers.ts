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
import { requireTier, getEffectiveTier } from './tierGate.js';
import { log, serializeErr } from './log.js';

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
  /** Optional cancellation hook. The HTTP layer should call this when the
   *  client disconnects so the upstream Regolo stream stops being consumed. */
  cancel?: () => void;
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

  // Stable filename per user — `upsert: true` overwrites the previous
  // upload in place, instead of accumulating one file per change. This
  // means a user with 100 profile updates has 1 file in storage, not 100,
  // and an overwritten photo is genuinely gone (subject to CDN cache TTL)
  // rather than retrievable via its old timestamped URL forever.
  //
  // We still version the *URL* with a `?v=<ts>` query so cache layers
  // (Supabase CDN, the user's browser) refetch on update without us
  // having to bust the cache by changing the path.
  const fileName = `users/${userId}/profile.${ext}`;
  const { error } = await supabase.storage
    .from('user-uploads')
    .upload(fileName, buffer, { contentType: sniffedMime, upsert: true });

  if (error) {
    log.error('storage_upload_failed', { userId, err: serializeErr(error) });
    return serverError('Storage upload failed', 'STORAGE_ERROR');
  }

  // Best-effort cleanup of legacy timestamped uploads from the previous
  // path scheme (`profile-<ts>.ext`). This runs once per upload and the
  // result is non-fatal — if the list/delete fails, the new file is still
  // saved correctly. Skipping on error keeps the happy path fast.
  try {
    const { data: existing } = await supabase.storage
      .from('user-uploads')
      .list(`users/${userId}`, { limit: 100 });
    const stale = (existing ?? [])
      .filter((f) => f.name.startsWith('profile-'))
      .map((f) => `users/${userId}/${f.name}`);
    if (stale.length > 0) {
      await supabase.storage.from('user-uploads').remove(stale);
    }
  } catch (cleanupErr) {
    log.warn('profile_photo_cleanup_skipped', { userId, err: serializeErr(cleanupErr) });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('user-uploads').getPublicUrl(fileName);

  // Version the URL so caches refetch on next update.
  const versioned = `${publicUrl}?v=${Date.now()}`;

  return { status: 200, body: { success: true, url: versioned, fileName } };
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
  // Server-side tier gate. The React route guard already blocks free
  // users from /advisor, but a direct API call would otherwise bypass it.
  const denied = await requireTier(req, supabase, 'strategist');
  if (denied) return denied;
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
    log.error('advisor_session_create_failed', { userId, err: serializeErr(error) });
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
  const denied = await requireTier(req, supabase, 'strategist');
  if (denied) return denied;
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
    .select('id, role, content, timestamp, reaction')
    .eq('session_id', session.id)
    .order('timestamp', { ascending: true })
    .limit(50);

  if (messagesError) {
    log.error('advisor_messages_fetch_failed', { userId, err: serializeErr(messagesError) });
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
  // No tier check on DELETE — we always let users clean up their own
  // data even if they downgrade (otherwise tier expiry would strand
  // sessions they can no longer manage).
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
 * PATCH /api/advisor/messages/:messageId/reaction — authenticated.
 * Update the user's reaction (like/dislike) on a specific message.
 */
export async function handleUpdateAdvisorReaction(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const denied = await requireTier(req, supabase, 'strategist');
  if (denied) return denied;

  const messageId = req.params.messageId;
  if (!isValidUUID(messageId)) return badRequest('Invalid messageId', 'INVALID_UUID');

  const { reaction } = req.body || {};
  if (reaction !== undefined && reaction !== 'like' && reaction !== 'dislike' && reaction !== null) {
    return badRequest('reaction must be "like", "dislike", or null');
  }

  // Verify the message belongs to the user's session
  const { data: message } = await supabase
    .from('advisor_messages')
    .select('session_id, user_id')
    .eq('id', messageId)
    .maybeSingle();

  if (!message || message.user_id !== req.user.id) {
    return { status: 404, body: { error: 'Message not found', code: 'NOT_FOUND' } };
  }

  // Update reaction
  const { error } = await supabase
    .from('advisor_messages')
    .update({ reaction: reaction ?? null })
    .eq('id', messageId);

  if (error) {
    log.error('advisor_reaction_update_failed', {
      userId: req.user.id,
      messageId,
      err: serializeErr(error),
    });
    return serverError('Failed to update reaction');
  }

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
  message: string,
  /**
   * Effective tier for the caller. Oracle gets a deeper history budget so
   * the model carries more context across long conversations. Strategist
   * uses the default. Free shouldn't reach this code path (route gate
   * blocks it) but treats free as Strategist if it does.
   */
  tier: 'free' | 'strategist' | 'oracle' = 'strategist',
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
- Keep responses under 250 words.
- If the user mentions a specific person ("she/her"), infer possible intentions based on behavior patterns, but avoid assumptions.

## EPIMETHEUS TYPE FRAMEWORK
The user is assessed on three axes forming an 8-type system:
• TIME (T/N): Tester vs Investor — does she test before committing, or invest deeply upfront?
• SEX (D/J): Denier vs Justifier — conservative/guarded vs open/rebellious with intimacy?
• RELATIONSHIP (R/I): Realist vs Idealist — practical/independent vs romantic/traditional?

8 Types: TDI (Playette), TJI (Social Butterfly), TDR (Private Dancer), TJR (Seductress),
         NDI (Hopeful Romantic), NJI (Cinderella), NDR (Connoisseur), NJR (Modern Woman).

## USER PROFILE
Personality Type: ${personalityType}
${personalityType !== 'Unknown' ? `
Type Context: ${(() => {
  const typeMap: Record<string, string> = {
    TDI: 'Tests interest, guards emotions, seeks deep connection — patient and selective.',
    TJI: 'Tests interest, expressive/social, seeks excitement — high energy, low patience.',
    TDR: 'Tests interest, guards emotions, practical focus — values stability and respect.',
    TJR: 'Tests interest, expressive/direct, practical focus — bold and action-oriented.',
    NDI: 'Invests early, guards emotions, seeks deep connection — thoughtful romantic.',
    NJI: 'Invests early, expressive/social, seeks fairy tale — classic romantic dreamer.',
    NDR: 'Invests early, guards emotions, practical focus — stable long-term builder.',
    NJR: 'Invests early, expressive/direct, practical focus — committed and realistic.',
  };
  return typeMap[personalityType] || 'Unique profile.';
})()}` : ''}
Traits Analysis:
${traits && Object.keys(traits).length > 0
  ? [
      `  Time Orientation: ${Math.round(traits.timeOrientation ?? 50)}/100 (0 = Investor, 100 = Tester)`,
      `  Emotional Style:  ${Math.round(traits.emotionalStyle ?? 50)}/100 (0 = Justifier, 100 = Denier)`,
      `  Relationship Focus: ${Math.round(traits.relationshipFocus ?? 50)}/100 (0 = Idealist, 100 = Realist)`,
    ].join('\n')
  : '  Not yet calibrated'}

## CONVERSATION CONTEXT
Recent Sessions: ${recentActivity?.map((s) => s.title).join(', ') || 'None'}
Message History: ${history?.length || 0} messages in this session

## RESPONSE GUIDELINES
- Include 1-2 specific, actionable steps when giving advice
- Ask thoughtful questions to deepen understanding
- Reference user's calibration data when relevant
- End with a forward-looking suggestion or question
- Maintain professional, insightful tone

## EXAMPLE EXCHANGES
User: "She laughed at my joke but then looked away. What does that mean?"
Assistant: "That's a mixed signal — laughter shows interest, but looking away suggests she's either shy (Denier trait) or testing your persistence (Tester). Since you're a TDR, your instinct is probably to back off and observe. Instead, try one more light comment to see if she re-engages. If she does, she's interested but cautious. If not, she's signaling 'not now.' What was the context of the interaction?"

User: "I want to ask her out but I'm nervous she'll say no."
Assistant: "That fear is normal, but here's the frame: her 'no' isn't about your worth — it's about timing, compatibility, or her current situation. As an NDI, you invest emotionally before acting, which amplifies the stakes. Reframe it: you're gathering data, not risking everything. Ask casually: 'Want to grab coffee this week?' If she hesitates, you have your answer without a hard rejection. What's holding you back specifically — fear of awkwardness, or losing the friendship?"

User: "She keeps texting me but won't commit to plans."
Assistant: "Classic Tester behavior — she's keeping you warm while evaluating other options or waiting for higher interest on her end. Your move depends on your type: if you're an Investor (N), this drains you because you're already in. If you're a Tester (T), match her energy — reply but don't chase. Set a boundary: 'Let me know when your schedule clears up, I'd like to see you.' Then pull back. If she's interested, she'll commit. If not, you've freed yourself. How long has this pattern been going on?"`;

  // Token-aware truncation: approximate 1 token ≈ 4 chars.
  // Reserve ~2000 tokens for system prompt + new user message + response.
  // Llama 3.3 70B has 8192 context; leave room for the response (600 tokens max).
  //
  // Tier-aware history budget — Oracle gets ~7.5k chars more (≈1.8k tokens
  // more conversation context), backing the "deep-dive AI sessions
  // (extended context)" Oracle promise on the pricing page. Strategist
  // stays at 20k chars (~5k tokens). Both leave headroom for system
  // prompt + new message + response within the 8192 context.
  const MAX_HISTORY_CHARS = tier === 'oracle' ? 27500 : 20000;
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
  const denied = await requireTier(req, supabase, 'strategist');
  if (denied) return denied;
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

  // Tier-aware budgets. Oracle gets:
  //   - More conversation history kept in-context (handled inside
  //     buildAdvisorMessages via the `tier` arg)
  //   - More output tokens, so longer multi-paragraph answers don't get
  //     cut mid-sentence
  // Strategist keeps the previous 600-token budget which is plenty for
  // the existing under-250-words system prompt cap.
  const { tier, isAdmin } = await getEffectiveTier(req, supabase);
  const effectiveTier = isAdmin ? 'oracle' : tier;
  const ADVISOR_MAX_TOKENS = effectiveTier === 'oracle' ? 1200 : 600;

  const messages = await buildAdvisorMessages(
    supabase,
    userId,
    sessionId,
    message,
    effectiveTier,
  );

  // Save user message first, before streaming.
  await supabase.from('advisor_messages').insert({
    session_id: sessionId,
    user_id: userId,
    role: 'user',
    content: message,
  });

  // Cancellation token shared between the generator and the response writer.
  // The Express/Vercel layer can flip cancelled=true when the client closes
  // the connection; the generator polls it and exits early so we stop reading
  // (and stop billing) Regolo tokens for an audience that's gone.
  const cancelToken: { cancelled: boolean; reader?: ReadableStreamDefaultReader<Uint8Array> } = {
    cancelled: false,
  };

  const stream = (async function* (): AsyncGenerator<string> {
    let fullContent = '';
    let sourceReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    try {
      const sourceStream = (await createCompletion({
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: ADVISOR_MAX_TOKENS,
        stream: true,
      })) as ReadableStream;

      sourceReader = sourceStream.getReader();
      cancelToken.reader = sourceReader;
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;
      const maxChunks = 500;
      // Defensive cap: if the upstream ever sends a giant payload without
      // any \n\n delimiter, we don't want `buffer` to grow without bound.
      // 1 MB is far above any reasonable single SSE event from Regolo.
      const MAX_BUFFER_BYTES = 1_000_000;
      // Inactivity guard: if no chunks arrive for INACTIVITY_MS, treat the
      // stream as stalled and bail. The fetch in createCompletion uses a
      // connect-only timeout for streams (STREAM_CONNECT_MS) so we own the
      // body-phase deadline here.
      const INACTIVITY_MS = 30_000;
      let lastChunkAt = Date.now();

      try {
        while (chunkCount++ < maxChunks) {
          if (cancelToken.cancelled) break;
          if (Date.now() - lastChunkAt > INACTIVITY_MS) {
            log.warn('advisor_stream_inactive', { userId, sessionId });
            break;
          }
          const { done, value } = await sourceReader.read();
          if (done) break;
          lastChunkAt = Date.now();
          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > MAX_BUFFER_BYTES) {
            log.warn('advisor_stream_buffer_overflow', {
              userId,
              sessionId,
              bufferBytes: buffer.length,
              maxBufferBytes: MAX_BUFFER_BYTES,
            });
            break;
          }

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
        try {
          sourceReader.releaseLock();
        } catch {
          // best-effort
        }
      }

      if (!cancelToken.cancelled) {
        yield `data: [DONE]\n\n`;
      }
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
      if (!cancelToken.cancelled) {
        yield `data: ${JSON.stringify({ content: errorMessage })}\n\n`;
        yield `data: [DONE]\n\n`;
      }
    } finally {
      // Persist whatever we have. Even partial content from a client
      // disconnect is worth saving so the user sees their reply on reload.
      // If the cancel happened BEFORE the first token arrived, we'd
      // otherwise leave the user's message paired with no model reply,
      // which distorts buildAdvisorMessages on the next turn (model sees
      // a lopsided history). Insert a placeholder so the conversation
      // shape stays balanced.
      const wasCancelledEarly =
        cancelToken.cancelled && fullContent.length === 0;
      const persistedContent = wasCancelledEarly
        ? '[interrupted before reply]'
        : fullContent;

      if (persistedContent.length > 0) {
        try {
          await supabase.from('advisor_messages').insert({
            session_id: sessionId,
            user_id: userId,
            role: 'model',
            content: persistedContent,
          });
          await supabase
            .from('advisor_sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', sessionId);
        } catch (dbError) {
          log.error('advisor_chat_persist_failed', {
            userId,
            sessionId,
            err: serializeErr(dbError),
          });
        }
      }
    }
  })();

  return { status: 200, stream, cancel: () => {
    cancelToken.cancelled = true;
    if (cancelToken.reader) {
      try { cancelToken.reader.cancel(); } catch { /* ignore */ }
    }
  } };
}

/**
 * Validate and normalize an Oracle analysis result before persisting.
 * Mirrors the AnalysisResult interface in src/pages/CalibrationPage.tsx but
 * applies length/shape clamps so a malicious client can't push an arbitrary
 * blob into Postgres. Returns a sanitized copy or null if structurally invalid.
 */
function sanitizeOracleResult(raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null;

  const VALID_TYPES = new Set(['TDI', 'TJI', 'TDR', 'TJR', 'NDI', 'NJI', 'NDR', 'NJR']);
  const VALID_PRIORITY = new Set(['low', 'medium', 'high']);
  const VALID_CATEGORY = new Set(['communication', 'physical', 'logistics', 'psychology']);

  const primaryType = String(raw.primaryType || '').toUpperCase();
  if (!VALID_TYPES.has(primaryType)) return null;

  const confidence = Math.max(0, Math.min(100, Number(raw.confidence) || 0));
  const secondaryType =
    raw.secondaryType && VALID_TYPES.has(String(raw.secondaryType).toUpperCase())
      ? String(raw.secondaryType).toUpperCase()
      : null;

  const clampStr = (v: any, max: number) => String(v ?? '').slice(0, max);
  const clampStrArr = (v: any, maxItems: number, maxLen: number) =>
    Array.isArray(v) ? v.slice(0, maxItems).map((x) => clampStr(x, maxLen)) : [];

  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.slice(0, 20).map((t: any, i: number) => ({
        id: clampStr(t?.id || `task-${Date.now()}-${i}`, 80),
        title: clampStr(t?.title, 200),
        description: clampStr(t?.description, 1000),
        priority: VALID_PRIORITY.has(t?.priority) ? t.priority : 'medium',
        dueDate: clampStr(t?.dueDate, 50),
        completed: Boolean(t?.completed),
        category: VALID_CATEGORY.has(t?.category) ? t.category : 'psychology',
      }))
    : [];

  const objOf3 = (v: any, k1: string, k2: string, k3: string, max: number) => ({
    [k1]: clampStr(v?.[k1], max),
    [k2]: clampStr(v?.[k2], max),
    [k3]: clampStr(v?.[k3], max),
  });

  return {
    primaryType,
    confidence,
    secondaryType,
    analysis: clampStr(raw.analysis, 4000),
    indicators: clampStrArr(raw.indicators, 10, 500),
    tasks,
    coldReader: clampStr(raw.coldReader, 1000),
    howSheGetsWhatSheWants: clampStr(raw.howSheGetsWhatSheWants, 2000),
    whatToAvoid: clampStrArr(raw.whatToAvoid, 10, 500),
    relationshipAdvice: objOf3(raw.relationshipAdvice, 'vision', 'investment', 'potential', 1500),
    freakDynamics: objOf3(raw.freakDynamics, 'kink', 'threesomes', 'worship', 1500),
    darkMindBreakdown: clampStr(raw.darkMindBreakdown, 4000),
    behavioralBlueprint: clampStr(raw.behavioralBlueprint, 4000),
    interactionStrategy: clampStr(raw.interactionStrategy, 2000),
  };
}

/**
 * POST /api/oracle/analyses — authenticated.
 * Persists a CalibrationPage AI Oracle result. Previously the client wrote
 * directly to the oracle_analyses table — RLS protected user_id ownership but
 * not the JSON shape. This endpoint validates and clamps the payload so a
 * compromised client can't bloat the column with arbitrary data.
 *
 * Body: { input: object, result: object, scenarioSummary?: string }
 * Returns: { id, ...persisted row }
 */
export async function handleCreateOracleAnalysis(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {  if (!req.user) return unauthorized();
  const denied = await requireTier(req, supabase, 'strategist');
  if (denied) return denied;
  const userId = req.user.id;

  const { input, result, scenarioSummary } = req.body || {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return badRequest('input must be an object');
  }
  // Cap the input blob — it's a structured form, never large in practice.
  const inputJson = JSON.stringify(input);
  if (inputJson.length > 20_000) {
    return badRequest('input payload too large (max 20KB)');
  }

  const sanitized = sanitizeOracleResult(result);
  if (!sanitized) {
    return badRequest('result has invalid shape', 'INVALID_RESULT');
  }

  const summary =
    typeof scenarioSummary === 'string' ? scenarioSummary.slice(0, 200) : '';

  // Belt-and-braces: ensure a users row exists so the FK doesn't fail on first
  // analysis. The auth context normally creates this on sign-in but a stale
  // tab can race past it.
  await supabase.from('users').upsert(
    { id: userId, email: req.user.email ?? null },
    { onConflict: 'id', ignoreDuplicates: false }
  );

  const { data: inserted, error } = await supabase
    .from('oracle_analyses')
    .insert({
      user_id: userId,
      input,
      result: sanitized,
      scenario_summary: summary,
      timestamp: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    log.error('oracle_analysis_insert_failed', { userId, err: serializeErr(error) });
    return serverError('Failed to save analysis', 'DB_INSERT_ERROR');
  }

  return { status: 200, body: { id: inserted.id, analysis: inserted } };
}

/**
 * Sanitize a single task before merging into result.tasks. Mirrors the
 * per-task clamps in sanitizeOracleResult so a compromised client can't
 * smuggle arbitrary blobs into the JSON column via the patch endpoint.
 */
function sanitizeTask(raw: any, fallbackId: string): {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  completed: boolean;
  category: 'communication' | 'physical' | 'logistics' | 'psychology';
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const VALID_PRIORITY = new Set(['low', 'medium', 'high']);
  const VALID_CATEGORY = new Set(['communication', 'physical', 'logistics', 'psychology']);
  const clamp = (v: any, max: number) => String(v ?? '').slice(0, max);
  return {
    id: clamp(raw.id || fallbackId, 80),
    title: clamp(raw.title, 200),
    description: clamp(raw.description, 1000),
    priority: VALID_PRIORITY.has(raw.priority) ? raw.priority : 'medium',
    dueDate: clamp(raw.dueDate, 50),
    completed: Boolean(raw.completed),
    category: VALID_CATEGORY.has(raw.category) ? raw.category : 'psychology',
  };
}

/**
 * PATCH /api/oracle/analyses/:id/tasks — authenticated.
 *
 * Replaces `result.tasks` on an existing oracle_analyses row owned by the
 * caller. Used by CalibrationPage's task toggle / "mark all" actions, which
 * previously wrote directly to the table. RLS still enforces ownership, but
 * the server now also re-validates the task shape and caps the array length,
 * matching what `handleCreateOracleAnalysis` does on insert.
 *
 * Body: { tasks: Task[] }
 */
export async function handleUpdateOracleAnalysisTasks(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const denied = await requireTier(req, supabase, 'strategist');
  if (denied) return denied;
  const userId = req.user.id;
  const id = req.params.id;
  if (!isValidUUID(id)) return badRequest('Invalid analysis id', 'INVALID_UUID');

  const rawTasks = req.body?.tasks;
  if (!Array.isArray(rawTasks)) {
    return badRequest('tasks must be an array');
  }
  if (rawTasks.length > 50) {
    return badRequest('Too many tasks (max 50)');
  }

  const sanitizedTasks = rawTasks
    .map((t: any, i: number) => sanitizeTask(t, `task-${id}-${i}`))
    .filter((t): t is NonNullable<ReturnType<typeof sanitizeTask>> => t !== null);

  // Confirm ownership before mutating. RLS would also block, but a 404 is a
  // friendlier response than a silent zero-row update.
  const { data: existing } = await supabase
    .from('oracle_analyses')
    .select('user_id, result')
    .eq('id', id)
    .maybeSingle();

  if (!existing || existing.user_id !== userId) {
    return { status: 404, body: { error: 'Analysis not found', code: 'NOT_FOUND' } };
  }

  // Merge tasks into the existing result blob rather than overwriting the row.
  const nextResult = { ...(existing.result ?? {}), tasks: sanitizedTasks };

  const { data: updated, error } = await supabase
    .from('oracle_analyses')
    .update({ result: nextResult })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    log.error('oracle_tasks_update_failed', { userId, analysisId: id, err: serializeErr(error) });
    return serverError('Failed to update tasks', 'DB_UPDATE_ERROR');
  }

  return { status: 200, body: { id: updated.id, tasks: sanitizedTasks } };
}

/**
 * DELETE /api/oracle/analyses/:id — authenticated.
 *
 * Owner-only delete of a single oracle_analyses row. Mirrors the pattern
 * used by /api/advisor/session/:id (verify ownership, return 404 if not
 * found, then delete).
 */
export async function handleDeleteOracleAnalysis(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  // No tier gate on DELETE — owners can always clean up after themselves
  // even after a tier downgrade. Mirrors handleDeleteAdvisorSession.
  const userId = req.user.id;
  const id = req.params.id;
  if (!isValidUUID(id)) return badRequest('Invalid analysis id', 'INVALID_UUID');

  const { data: existing } = await supabase
    .from('oracle_analyses')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (!existing || existing.user_id !== userId) {
    return { status: 404, body: { error: 'Analysis not found', code: 'NOT_FOUND' } };
  }

  const { error } = await supabase.from('oracle_analyses').delete().eq('id', id);
  if (error) {
    log.error('oracle_analysis_delete_failed', { userId, analysisId: id, err: serializeErr(error) });
    return serverError('Failed to delete analysis', 'DB_DELETE_ERROR');
  }
  return { status: 200, body: { success: true } };
}

/**
 * POST /api/calibration/analyze — authenticated.
 */
export async function handleCalibrationAnalyze(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const denied = await requireTier(req, supabase, 'strategist');
  if (denied) return denied;
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
    log.error('calibration_analysis_failed', { userId, err: serializeErr(err) });
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
    // We give non-streaming completions almost the full Vercel budget
    // (30s default for the deployed function). The Oracle calibration
    // prompt is big and Llama-3.3-70B can take 25s+ for the structured
    // JSON response — anything tighter cascades into the fallback model
    // chain and confuses the user. The remaining 2s headroom covers
    // response.text() + parsing on our side.
    const TIMEOUT_MS = 28_000;
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


/**
 * DELETE /api/users/me — authenticated.
 *
 * Self-serve account deletion. The user submits a confirmation phrase
 * (their own email, lowercased) so a single accidental click can't wipe
 * the account; the request body must include `{ confirm: <email> }`.
 *
 * Order of operations:
 *   1. Verify the auth header → req.user (already done by the caller).
 *   2. Verify the confirmation phrase matches the authenticated email.
 *   3. Call supabase.auth.admin.deleteUser(uid). This deletes the row in
 *      auth.users, which cascades to public.users via the FK, which in
 *      turn cascades to every child table (advisor_*, calibrations,
 *      oracle_analyses, dossiers, favorites, assessment_results, …) and
 *      fires the trg_purge_user_storage_objects trigger so files in
 *      `users/<uid>/` get deleted from storage.
 *
 * After this returns, the client should:
 *   - Drop its local auth state (signOut + clear localStorage scoped
 *     keys; in this codebase that means letting the SIGNED_OUT event
 *     fire, which the auth context already handles).
 *   - Redirect to the public landing page.
 *
 * Privacy Policy section 8 promises the user can delete their account
 * from inside the app; this endpoint is what makes that promise truthful.
 */
export async function handleDeleteMyAccount(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const userId = req.user.id;
  const userEmail = (req.user.email || '').toLowerCase();

  const confirmRaw = req.body?.confirm;
  if (typeof confirmRaw !== 'string') {
    return badRequest('Confirmation phrase is required', 'CONFIRM_REQUIRED');
  }
  // The user must type their email back at us to delete. This is enough
  // friction to prevent fat-finger account loss without being annoying.
  if (confirmRaw.trim().toLowerCase() !== userEmail) {
    return badRequest(
      'Confirmation phrase does not match the account email',
      'CONFIRM_MISMATCH'
    );
  }
  if (!userEmail) {
    // No email on file (shouldn't happen for a verified user, but guard
    // anyway — the empty-string equality above would let the user past).
    return badRequest('Account has no email; contact support', 'NO_EMAIL');
  }

  // supabase.auth.admin.* requires the service role client, which is what
  // the API server uses by construction. Do not expose this surface to
  // anon-keyed clients.
  //
  // Order:
  //   1. DELETE FROM public.users — this fires the storage cleanup
  //      trigger AND cascades to every child table via FKs. If it fails,
  //      the auth row still exists and the user can retry. We avoid the
  //      reverse order (auth first, then public) because a failure
  //      between them leaves an orphan: auth gone, public present, no
  //      way for the user to retry because they can no longer sign in.
  //   2. supabase.auth.admin.deleteUser — once public is gone the auth
  //      row has nothing to point at; the auth.users → public.users FK
  //      added by 20240101000700 cascades the other way too on auth
  //      delete, so this final step also acts as belt-and-braces for
  //      anyone who hit this endpoint pre-FK migration.
  try {
    const { error: dbErr } = await supabase.from('users').delete().eq('id', userId);
    if (dbErr) throw dbErr;
  } catch (dbErr) {
    log.error('account_delete_db_step_failed', { userId, err: serializeErr(dbErr) });
    return serverError('Failed to delete account', 'DELETE_FAILED');
  }

  const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
  if (authErr) {
    // public.users is already gone; the user can't sign in anymore. Log
    // loudly so an operator can clean up the orphan auth row manually,
    // but report success to the client because the user-visible state
    // (no app data, can't sign in) matches "deleted".
    log.warn('account_delete_auth_step_orphan', { userId, err: serializeErr(authErr) });
  }

  log.info('account_deleted', { userId });
  return { status: 200, body: { success: true } };
}

/**
 * DELETE /api/admin/users/:id — admin-only.
 *
 * Companion to handleDeleteMyAccount, but for AdminDashboard. Without
 * this endpoint, AdminDashboard.tsx was deleting only `public.users`
 * directly via the supabase client. After 20240101000700 added the
 * `public.users.id → auth.users.id ON DELETE CASCADE` foreign key, that
 * delete-from-public path leaves the auth.users row intact (the FK
 * cascade is one-way: auth → public). Result: a "ghost" account that
 * can still authenticate, can recreate its public.users row on next
 * sign-in, and bypasses every audit trail.
 *
 * This handler:
 *   1. Verifies the caller is an admin (role === 'admin' in public.users).
 *   2. Refuses to delete the caller's own account (the operator should
 *      use the self-serve endpoint with proper email confirmation).
 *   3. Deletes via supabase.auth.admin.deleteUser(targetId), which
 *      cascades through the FK to public.users → child tables → storage
 *      cleanup trigger. Same cascade semantics as the self-serve flow,
 *      just without the email confirmation step (admins are trusted to
 *      know what they're doing).
 */
export async function handleAdminDeleteUser(
  req: NormalizedRequest,
  supabase: SupabaseClient
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const adminId = req.user.id;
  const targetId = req.params?.id;
  if (!targetId || !isValidUUID(targetId)) {
    return badRequest('Valid user ID required', 'INVALID_USER_ID');
  }
  if (targetId === adminId) {
    return {
      status: 400,
      body: {
        error: 'Admins cannot delete their own account here. Use the self-serve flow on your profile page.',
        code: 'CANNOT_SELF_DELETE',
      },
    };
  }

  // Verify the caller is actually an admin. The route guard on the
  // client checks this, but the client guard runs in the user's
  // browser — anyone with a valid JWT could call this endpoint
  // directly with curl. The server is the only enforcement that
  // matters.
  const { data: callerRow, error: callerErr } = await supabase
    .from('users')
    .select('role')
    .eq('id', adminId)
    .maybeSingle();
  if (callerErr) {
    log.error('admin_delete_caller_lookup_failed', {
      adminId,
      err: serializeErr(callerErr),
    });
    return serverError('Authorization check failed', 'AUTH_CHECK_FAILED');
  }
  if (!callerRow || callerRow.role !== 'admin') {
    return { status: 403, body: { error: 'Admin role required', code: 'FORBIDDEN' } };
  }

  // Drive the cascade from the auth side. The FK added in
  // 20240101000700 makes `public.users` (and every child table that
  // FKs to it) cascade automatically, AND the storage purge trigger
  // fires on `public.users` AFTER DELETE. Doing the auth delete first
  // here is the inverse order vs handleDeleteMyAccount because the
  // admin path doesn't worry about a "user can't sign in to retry"
  // scenario — if it fails, the operator just retries.
  const { error: authErr } = await supabase.auth.admin.deleteUser(targetId);
  if (authErr) {
    log.error('admin_delete_auth_failed', {
      adminId,
      targetId,
      err: serializeErr(authErr),
    });
    return serverError('Failed to delete user', 'DELETE_FAILED');
  }

  // Belt-and-braces: if for any reason the FK cascade didn't fire
  // (e.g. the user was created before 20240101000700 and the row
  // somehow escaped that migration's backfill), explicitly delete the
  // public row. This is a no-op when the cascade already worked.
  const { error: dbErr } = await supabase.from('users').delete().eq('id', targetId);
  if (dbErr) {
    log.warn('admin_delete_public_cleanup_failed', {
      adminId,
      targetId,
      err: serializeErr(dbErr),
    });
  }

  log.info('admin_user_deleted', { adminId, targetId });
  return { status: 200, body: { success: true } };
}
