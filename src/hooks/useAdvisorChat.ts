import { useState, useEffect, useCallback, useRef } from 'react';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { isUUID } from '../utils/validation';
import { sanitizeAiResponse } from '../utils/sanitizeHtml';
import { stripThinking } from '../lib/ai';
import { ThinkStripper } from '../utils/thinkStrip';
import { toast } from 'sonner';
import { apiFetch } from '../lib/fetch';
import { parseApiError, type ParsedApiError } from '../lib/apiError';

/**
 * Subclass of Error that carries the parsed API error so the catch block
 * in `sendMessage` can branch on `code` (PAYMENT_REQUIRED → redirect to
 * /pricing, RATE_LIMITED → cooldown toast, etc.) instead of just
 * displaying the raw message.
 */
class AdvisorChatError extends Error {
  readonly parsed: ParsedApiError;
  constructor(parsed: ParsedApiError) {
    super(parsed.message);
    this.name = 'AdvisorChatError';
    this.parsed = parsed;
  }
}

/**
 * Thrown when the SSE stream breaks mid-reply (server error event, network
 * drop, or malformed stream). `partial` carries the text that arrived before
 * the failure so the caller can keep it in the transcript and attach an
 * inline error marker instead of pretending the whole exchange failed.
 */
class StreamError extends Error {
  readonly partial: string;
  constructor(message: string, partial: string) {
    super(message);
    this.name = 'StreamError';
    this.partial = partial;
  }
}

export interface AdvisorMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp?: Date;
  failed?: boolean;
  reaction?: 'like' | 'dislike';
  /** Inline stream/response error for model bubbles (rendered under the bubble). */
  error?: string;
}

interface RawMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp?: string | number | Date;
  reaction?: 'like' | 'dislike';
}

const STREAM_DONE = '[DONE]';

export function useAdvisorChat() {
  const { user } = useEnhancedAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Refs that always read latest values inside callbacks (avoids stale closures).
  const sessionIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const isStreamingRef = useRef(false);

  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { userIdRef.current = user?.id ?? null; }, [user]);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Initialize session
  useEffect(() => {
    const initializeSession = async (retryCount = 0) => {
      if (!user?.id || !isUUID(user.id)) {
        setIsLoadingSession(false);
        return;
      }
      try {
        // userId is now derived server-side from the JWT; query param is no longer needed.
        const response = await apiFetch('/api/advisor/session');
        if (response.ok) {
          const data = await response.json();
          if (data.sessionId) {
            setSessionId(data.sessionId);
            if (Array.isArray(data.messages) && data.messages.length > 0) {
              setMessages(data.messages.map((msg: RawMessage) => ({
                id: msg.id,
                role: msg.role,
                // History can contain persisted <think> blocks from before
                // the server-side strip landed — clean them for display too.
                content: msg.role === 'model' ? stripThinking(msg.content) : msg.content,
                timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
                reaction: msg.reaction,
              })));
            }
            setIsLoadingSession(false);
            return;
          }
        }
        // No session yet — create one
        const createResponse = await apiFetch('/api/advisor/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'AI Advisor Session' }),
        });
        if (createResponse.ok) {
          const data = await createResponse.json();
          setSessionId(data.sessionId);
        } else {
          throw new Error(`Failed to create session: ${createResponse.status}`);
        }
      } catch (error) {
        console.error('Session initialization error:', error);
        // Retry up to 3 times with exponential backoff
        if (retryCount < 3) {
          const delay = 1000 * Math.pow(2, retryCount);
          setTimeout(() => initializeSession(retryCount + 1), delay);
          return;
        }
        toast.error('Failed to initialize chat session. Please refresh.');
      } finally {
        setIsLoadingSession(false);
      }
    };
    initializeSession();
  }, [user]);

  /**
   * Send the request, stream the response, and update messages in place.
   * Reads sessionId/userId from refs to avoid stale closures.
   *
   * For the streaming bubble we batch updates with requestAnimationFrame
   * instead of calling setMessages per token. The previous per-chunk
   * `setMessages(prev => prev.map(...))` was O(messages × tokens) and made
   * long replies janky on slower devices.
   */
  const performSend = useCallback(async (content: string, assistantId: string) => {
    const sid = sessionIdRef.current;
    const uid = userIdRef.current;
    if (!sid || !uid) throw new Error('Session not ready');

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    // userId is derived server-side from JWT; only sessionId + message are needed.
    void uid;
    const response = await apiFetch('/api/advisor/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid, message: content }),
      signal: abortControllerRef.current.signal,
    });

    if (!response.ok) {
      // Use the centralized parser so we capture the structured shape
      // (code, requiredTier, retryAfter, requestId) instead of just the
      // free-text message. The catch in sendMessage branches on
      // parsed.code below.
      const parsed = await parseApiError(response);
      throw new AdvisorChatError(parsed);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new StreamError('No response stream from the server.', '');

    const decoder = new TextDecoder();
    let buffer = '';
    let assistantContent = '';
    // Incremental <think> remover: gpt-oss-120b / qwen3.5-122b stream their
    // chain-of-thought wrapped in <think> tags (often split across chunks).
    // Without this, raw reasoning prose leaks into the visible reply.
    const thinkStripper = new ThinkStripper();
    let placeholderAdded = false;

    // RAF-batched flush: each token mutates the local accumulator and schedules
    // at most one render per animation frame. The user still sees a smooth
    // typing effect (60fps), but React only does work once per frame.
    //
    // Timer kind is tracked separately because cancelAnimationFrame is a no-op
    // on a setTimeout id (and vice versa). On environments without RAF (older
    // SSR shims) we'd otherwise leak a setTimeout that fires after unmount.
    let rafId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const cancelScheduled = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    const flush = () => {
      rafId = null;
      timeoutId = null;
      const snapshot = assistantContent;
      // The assistant bubble is PRE-ADDED by sendMessage (empty placeholder)
      // so early failures still render a bubble. Update it in place when it
      // exists; append only as a fallback if it was somehow never added.
      // (The old append-first logic would now create a duplicate bubble.)
      placeholderAdded = true;
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === assistantId);
        if (idx === -1) {
          return [...prev, { id: assistantId, role: 'model', content: snapshot, timestamp: new Date() }];
        }
        const next = [...prev];
        next[idx] = { ...next[idx], content: snapshot };
        return next;
      });
    };
    const scheduleFlush = () => {
      if (rafId !== null || timeoutId !== null) return;
      if (typeof requestAnimationFrame === 'function') {
        rafId = requestAnimationFrame(flush);
      } else {
        timeoutId = setTimeout(flush, 16);
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Split on \n\n (SSE event boundary). Use a safer approach that handles \r\n too.
        let sep: number;
        while ((sep = findEventBoundary(buffer)) !== -1) {
          const event = buffer.slice(0, sep);
          buffer = buffer.slice(sep).replace(/^[\r\n]+/, '');

          // An event can contain multiple lines; we only care about data: lines.
          for (const line of event.split(/\r?\n/)) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trimStart();
            if (!data) continue;
            if (data === STREAM_DONE) {
              // Final flush so we don't lose any tail tokens after [DONE].
              cancelScheduled();
              flush();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                // Server-side failure mid-stream. StreamError (not Error) so
                // the outer catch can surface it inline instead of marking
                // the whole exchange as failed-to-send.
                throw new StreamError(parsed.error, assistantContent);
              }
              if (typeof parsed.content === 'string' && parsed.content.length > 0) {
                const cleaned = sanitizeAiResponse(thinkStripper.push(parsed.content));
                if (cleaned.length > 0) {
                  assistantContent += cleaned;
                  scheduleFlush();
                }
              }
            } catch (err) {
              // SyntaxError messages are localized across browsers ("Unexpected"
              // on V8, "JSON.parse:" on Firefox). Type-check is more robust.
              if (err instanceof SyntaxError) {
                // Ignore malformed JSON chunks
                continue;
              }
              throw err;
            }
          }
        }
      }
      // Stream ended without a server error but also without any content and
      // without [DONE] — the reply died silently. Previously this rendered
      // as "message sent, no reply ever appeared" with zero feedback.
      if (assistantContent.length === 0) {
        throw new StreamError('The advisor returned an empty response. Please try again.', '');
      }
    } finally {
      // Release any text the stripper held back at end of stream (an
      // unterminated think block is dropped — it was all reasoning).
      const tail = thinkStripper.flush();
      if (tail.length > 0) assistantContent += tail;
      cancelScheduled();
      // Ensure the user sees the final state even if the stream ended without [DONE].
      if (assistantContent && (placeholderAdded || assistantContent.length > 0)) {
        flush();
      }
      try { reader.releaseLock(); } catch { /* ignore */ }
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (!sessionIdRef.current || !isUUID(sessionIdRef.current) || !userIdRef.current || !isUUID(userIdRef.current)) {
      toast.error('Session not ready yet. Please wait a moment and try again.');
      return;
    }
    if (isStreamingRef.current) {
      return;
    }

    const userMessage: AdvisorMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    // Assistant bubble placeholder is added BEFORE the request so that if
    // the HTTP exchange fails (402/429/500), the retry affordance lives on
    // the user bubble — and crucially the user bubble still exists to be
    // retried. The old flow only created the assistant bubble once the
    // stream produced its first token, so an early failure left the user
    // message with no retry path and a "failed" flag nothing could use.
    const assistantId = `model-${Date.now()}`;
    setMessages(prev => [...prev, userMessage, { id: assistantId, role: 'model', content: '' }]);
    setIsStreaming(true);
    setErrorMessage(null);
    // Written by the catch block below, read by the finally block. A let
    // binding shared across both keeps the failed-send notice in sync with
    // the toast without duplicating the branch logic.
    let errorToSurface: string | null = null;

    try {
      await performSend(trimmed, assistantId);
    } catch (error) {
      // User-initiated abort isn't an error
      if (error instanceof Error && error.name === 'AbortError') {
        // Drop the assistant placeholder if the stop landed before any tokens
        // arrived — an empty bubble after "Stop" is just dead UI. Partial
        // replies (content already flushed) are kept, matching the server,
        // which persists the partial text.
        setMessages(prev => prev.filter(m => !(m.id === assistantId && m.content === '' && !m.error)));
        return;
      }
      console.error('Chat error:', error);

      // Structured-error branch: route the user appropriately based on
      // server-provided code rather than dumping the raw English string
      // into a toast. PAYMENT_REQUIRED is the most important — without
      // this, free users hitting the advisor saw a generic "This feature
      // requires the strategist plan" toast and had to manually find the
      // pricing page.
      if (error instanceof AdvisorChatError) {
        const { code, requiredTier, retryAfter, message } = error.parsed;
        if (code === 'PAYMENT_REQUIRED') {
          const tier = requiredTier ?? 'paid';
          toast.error(`The advisor requires the ${tier} plan.`, {
            description: 'Redirecting you to upgrade options…',
            action: {
              label: 'View plans',
              onClick: () => { window.location.href = '/pricing'; },
            },
          });
          // Soft redirect after a beat so the user sees the toast first.
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/pricing';
            }
          }, 1200);
        } else if (code === 'RATE_LIMITED' || code === 'USER_RATE_LIMITED') {
          const seconds = typeof retryAfter === 'number' ? retryAfter : null;
          toast.error("You're going too fast.", {
            description: seconds
              ? `Try again in ${seconds} seconds.`
              : 'Please wait a moment before retrying.',
          });
        } else if (code === 'AI_TIMEOUT') {
          toast.error('The AI took too long to respond.', {
            description: 'Try again — long prompts can be slow.',
          });
        } else if (code === 'MODEL_UNAVAILABLE') {
          toast.error('The AI is temporarily unavailable.', {
            description: 'Falling back automatically. Retry shortly.',
          });
        } else if (code === 'UNAUTHORIZED') {
          toast.error('Please sign in again to continue.');
        } else {
          toast.error(message || 'Message failed to send');
        }
      } else if (error instanceof StreamError) {
        // Stream broke mid-reply (or came back empty). The partial text is
        // already in the transcript — surface the failure inline on the
        // assistant bubble so the error sits next to the reply it broke,
        // instead of a disconnected toast.
        toast.error(error.message);
        errorToSurface = error.message;
      } else {
        const msg = error instanceof Error ? error.message : 'Message failed to send';
        toast.error(msg);
        errorToSurface = msg;
      }

      if (errorToSurface) {
        // Inline error marker on the assistant bubble. A blank model bubble
        // becomes a visible retry-style notice instead of a silent gap.
        setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, error: errorToSurface! } : m)));
      }

      // Mark the user message as failed so the user can retry it.
      setMessages(prev => prev.map(m => (m.id === userMessage.id ? { ...m, failed: true } : m)));
    } finally {
      setIsStreaming(false);
      setErrorMessage(errorToSurface);
    }
  }, [performSend]);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setErrorMessage(null);
  }, []);

  // Manually clear the fatal-error banner (dismiss button in the UI).
  const dismissError = useCallback(() => setErrorMessage(null), []);

  const retryMessage = useCallback(async (messageId: string) => {
    const target = messages.find(m => m.id === messageId);
    if (!target || target.role !== 'user') return;
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === messageId);
      if (idx === -1) return prev;
      // Drop the failed bubble entirely — sendMessage appends a fresh user
      // message. Keeping the original here (slice(0, idx + 1)) rendered the
      // same text twice after a retry.
      return prev.slice(0, idx);
    });
    await sendMessage(target.content);
  }, [messages, sendMessage]);

  const clearChat = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      await apiFetch(`/api/advisor/session/${sid}`, { method: 'DELETE' });
      setMessages([]);
      setErrorMessage(null);
      toast.success('Chat cleared');
    } catch (error) {
      console.error('Clear chat error:', error);
      toast.error('Failed to clear chat');
    }
  }, []);

  const setReaction = useCallback(async (messageId: string, reaction: 'like' | 'dislike' | undefined) => {
    // Capture the previous reaction BEFORE the optimistic update. The old
    // rollback read `messages` from this callback's closure, which still
    // held the pre-optimistic state — except it ran after the optimistic
    // setMessages in the same tick, so the "original" it restored was
    // actually already-correct data in most cases but stale-incorrect when
    // another update landed between the two calls. Snapshot is exact.
    let previousReaction: 'like' | 'dislike' | undefined;
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        previousReaction = m.reaction;
        return { ...m, reaction };
      }
      return m;
    }));

    // Persist to database
    try {
      const response = await apiFetch(`/api/advisor/messages/${messageId}/reaction`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction }),
      });
      if (!response.ok) {
        throw new Error('Failed to save reaction');
      }
    } catch (error) {
      console.error('Failed to save reaction:', error);
      // Revert optimistic update on error using the captured snapshot.
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, reaction: previousReaction } : m,
      ));
      toast.error('Failed to save reaction');
    }
  }, []);

  return {
    messages,
    sendMessage,
    stopStreaming,
    retryMessage,
    isStreaming,
    isLoadingSession,
    sessionId,
    errorMessage,
    dismissError,
    clearChat,
    setReaction,
  };
}

/**
 * Find the index where the next SSE event ends. SSE events are delimited by
 * a blank line, which can be \n\n or \r\n\r\n. Returns -1 if no full event yet.
 */
function findEventBoundary(buffer: string): number {
  const a = buffer.indexOf('\n\n');
  const b = buffer.indexOf('\r\n\r\n');
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
}

export type Message = AdvisorMessage;
