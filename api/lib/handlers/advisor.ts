import { retrieveChunks, type RetrievedChunk } from './rag/retriever.js';
import { buildRagPrompt } from './rag/promptBuilder.js';
import { reindexUser } from './rag/scheduler.js';
import { isRagEnabledForUser } from './handlers/rag.js';
/// <reference lib="dom" />
/**
 * Advisor domain.
 *
 * Verbatim from api/lib/handlers.ts:
 *   handleCreateAdvisorSession     lines 224-255
 *   handleGetAdvisorSession        lines 257-295
 *   handleDeleteAdvisorSession     lines 297-325
 *   handleUpdateAdvisorReaction    lines 327-374
 *   buildAdvisorMessages           lines 376-508   (private)
 *   handleAdvisorChatStream        lines 510-716
 *
 * The SSE generator, the cancel token, the 500-chunk / 1 MB / 30 s inactivity
 * guards and the `[interrupted before reply]` placeholder are all unchanged.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCompletion, DEFAULT_MODEL } from '../../_config.js';
import { isValidUUID } from '../auth.js';
import { requireTier, getEffectiveTier } from '../tierGate.js';
import { log, serializeErr } from '../log.js';
import { badRequest, serverError, unauthorized } from '../response.js';
import type { NormalizedRequest, NormalizedResponse, RouteDef } from '../types.js';

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

  // Fire-and-forget re-index so a new analysis becomes retrievable context for
  // the advisor. Deliberately not awaited: the response must not depend on an
  // embedding round trip, and `reindexUser` is idempotent and never throws.
  void reindexUser(userId, supabase, { reason: 'oracle-analysis' }).then((result) => {
    if (!result.ok) {
      log.warn('oracle_reindex_failed', { userId, error: result.error });
    }
  });
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
 * Static advisor prompt blocks.
 *
 * Extracted verbatim from the previous inline template literal so the value
 * served through the cache is byte-identical to what shipped before the
 * migration. They are read via `featuredCaches`, which memoises them in Redis
 * instead of re-assembling several kilobytes of constant text per chat call.
 */
const ADVISOR_TYPE_FRAMEWORK = `## EPIMETHEUS TYPE FRAMEWORK
The user is assessed on three axes forming an 8-type system:
• TIME (T/N): Tester vs Investor — does she test before committing, or invest deeply upfront?
• SEX (D/J): Denier vs Justifier — conservative/guarded vs open/rebellious with intimacy?
• RELATIONSHIP (R/I): Realist vs Idealist — practical/independent vs romantic/traditional?

8 Types: TDI (Playette), TJI (Social Butterfly), TDR (Private Dancer), TJR (Seductress),
         NDI (Hopeful Romantic), NJI (Cinderella), NDR (Connoisseur), NJR (Modern Woman).

`;

const ADVISOR_RESPONSE_GUIDELINES = `## RESPONSE GUIDELINES
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

/** Type id → one-line context sentence. Interpolated into the system prompt. */
const PERSONALITY_TYPE_CONTEXT: Record<string, string> = {
  TDI: "Tests interest, guards emotions, seeks deep connection — patient and selective.",
  TJI: "Tests interest, expressive/social, seeks excitement — high energy, low patience.",
  TDR: "Tests interest, guards emotions, practical focus — values stability and respect.",
  TJR: "Tests interest, expressive/direct, practical focus — bold and action-oriented.",
  NDI: "Invests early, guards emotions, seeks deep connection — thoughtful romantic.",
  NJI: "Invests early, expressive/social, seeks fairy tale — classic romantic dreamer.",
  NDR: "Invests early, guards emotions, practical focus — stable long-term builder.",
  NJR: "Invests early, expressive/direct, practical focus — committed and realistic.",
};

function personalityTypeContextFor(typeId: string): string {
  return Object.prototype.hasOwnProperty.call(PERSONALITY_TYPE_CONTEXT, typeId)
    ? PERSONALITY_TYPE_CONTEXT[typeId]
    : 'Unique profile.';
}

/**
 * Resolve the two static prompt blocks through the cache. A Redis outage
 * falls through to the in-process constants, so the prompt is never blank.
 */
async function loadAdvisorPromptBlocks(): Promise<{
  typeFramework: string;
  responseGuidelines: string;
}> {
  const [typeFramework, responseGuidelines] = await Promise.all([
    getCachedPromptBlock(PROMPT_TYPE_FRAMEWORK_KEY, PROMPT_BLOCK_TTL_SEC, () => ADVISOR_TYPE_FRAMEWORK),
    getCachedPromptBlock(
      PROMPT_RESPONSE_GUIDELINES_KEY,
      PROMPT_BLOCK_TTL_SEC,
      () => ADVISOR_RESPONSE_GUIDELINES,
    ),
  ]);
  return { typeFramework, responseGuidelines };
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
  /**
   * Retrieval-augmented context for this turn. An empty array (or an omitted
   * argument) keeps the pre-RAG prompt shape, so behaviour is unchanged when
   * retrieval yields nothing — the no-context path is the fallback, not an
   * error state.
   */
  retrieved: RetrievedChunk[] = [],
): Promise<Array<{ role: string; content: string }>> {
  const { typeFramework, responseGuidelines } = await loadAdvisorPromptBlocks();
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

${typeFramework}## USER PROFILE
Personality Type: ${personalityType}
${personalityType !== 'Unknown' ? `
Type Context: ${await getPersonalityTypeContext(personalityType, personalityTypeContextFor)}` : ''}
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

${responseGuidelines}`;

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

  // Sectioned prompt (SYSTEM / RETRIEVED CONTEXT / RECENT MESSAGES / USER
  // QUERY) when we have retrieved context; the legacy shape otherwise. Keeping
  // both means a retrieval outage degrades to exactly the prompt the advisor
  // used before RAG existed, rather than to a worse one.
  return buildRagPrompt({
    baseSystemPrompt: systemPrompt,
    chunks: retrieved,
    history: historyMessages,
    query: message,
    sectioned: retrieved.length > 0,
  });
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

  // Retrieval runs before the prompt is built so the retrieved chunks can be
  // placed inside the system prompt. Soft-fail by construction: a disabled
  // preference skips retrieval entirely, and `retrieveChunks` resolves to `[]`
  // on any error, which routes us to the no-context prompt path.
  const ragPreferenceEnabled = await isRagEnabledForUser(supabase, userId);
  const ragRequested =
    ragPreferenceEnabled && String(req.query?.no_rag ?? '') !== '1';
  const retrievalStartedAt = Date.now();
  const retrieved = ragRequested
    ? await retrieveChunks(userId, String(message), supabase)
    : [];
  const retrievalMs = Date.now() - retrievalStartedAt;
  log.info('advisor_retrieval', {
    userId,
    sessionId,
    ragRequested,
    chunks: retrieved.length,
    retrievalMs,
  });

  const messages = await buildAdvisorMessages(
    supabase,
    userId,
    sessionId,
    message,
    effectiveTier,
    retrieved,
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
    // Emit the retrieved-context frame before the first token so the client can
    // render the "Context used" panel without waiting for the answer.
    if (retrieved.length > 0) {
      yield `data: ${JSON.stringify({
        type: 'rag',
        retrievalMs,
        chunks: retrieved.map((chunk) => ({
          sourceTable: chunk.sourceTable,
          sourceId: chunk.sourceId,
          score: Number(chunk.score.toFixed(4)),
          preview:
            chunk.text.length > 180 ? `${chunk.text.slice(0, 177)}...` : chunk.text,
        })),
      })}\n\n`;
    }

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

export const routes: RouteDef[] = [
  {
    method: 'POST',
    path: '/api/advisor/session',
    auth: 'authenticated',
    handler: (req, supabase) => handleCreateAdvisorSession(req, supabase),
  },
  {
    method: 'GET',
    path: '/api/advisor/session',
    auth: 'authenticated',
    handler: (req, supabase) => handleGetAdvisorSession(req, supabase),
  },
  {
    method: 'DELETE',
    path: '/api/advisor/session/:sessionId',
    auth: 'authenticated',
    handler: (req, supabase) => handleDeleteAdvisorSession(req, supabase),
  },
  {
    method: 'PATCH',
    path: '/api/advisor/messages/:messageId/reaction',
    auth: 'authenticated',
    handler: (req, supabase) => handleUpdateAdvisorReaction(req, supabase),
  },
  {
    method: 'POST',
    path: '/api/advisor/chat',
    auth: 'authenticated',
    handler: (req, supabase) => handleAdvisorChatStream(req, supabase),
  },
];
