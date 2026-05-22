import { useState, useEffect, useCallback, useRef } from 'react';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { isUUID } from '../utils/validation';
import { sanitizeAiResponse } from '../utils/sanitizeHtml';
import { toast } from 'sonner';
import { apiFetch } from '../lib/fetch';

export interface AdvisorMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp?: Date;
  failed?: boolean;
}

interface RawMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp?: string | number | Date;
}

const STREAM_DONE = '[DONE]';

export function useAdvisorChat() {
  const { user } = useEnhancedAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
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
                content: msg.content,
                timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
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
   */
  const performSend = useCallback(async (content: string) => {
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
      let errMsg = `Chat failed: ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson.error) errMsg = errJson.error;
      } catch { /* not json */ }
      throw new Error(errMsg);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response stream');

    const decoder = new TextDecoder();
    const assistantId = `model-${Date.now()}`;
    let buffer = '';
    let assistantContent = '';
    let placeholderAdded = false;

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
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (typeof parsed.content === 'string' && parsed.content.length > 0) {
                assistantContent += sanitizeAiResponse(parsed.content);
                if (!placeholderAdded) {
                  placeholderAdded = true;
                  setMessages(prev => [
                    ...prev,
                    { id: assistantId, role: 'model', content: assistantContent, timestamp: new Date() },
                  ]);
                } else {
                  setMessages(prev =>
                    prev.map(m => (m.id === assistantId ? { ...m, content: assistantContent } : m)),
                  );
                }
              }
            } catch (err) {
              if (err instanceof Error && err.message && !err.message.startsWith('Unexpected')) {
                // Re-throw real errors (like { error: "..." } from server). Ignore JSON parse errors.
                throw err;
              }
              // Ignore malformed JSON chunks
            }
          }
        }
      }
    } finally {
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
    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    try {
      await performSend(trimmed);
    } catch (error) {
      // User-initiated abort isn't an error
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Chat error:', error);
      const msg = error instanceof Error ? error.message : 'Message failed to send';
      toast.error(msg);
      // Mark the user message as failed so the user can retry it.
      setMessages(prev => prev.map(m => (m.id === userMessage.id ? { ...m, failed: true } : m)));
    } finally {
      setIsStreaming(false);
    }
  }, [performSend]);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const retryMessage = useCallback(async (messageId: string) => {
    const target = messages.find(m => m.id === messageId);
    if (!target || target.role !== 'user') return;
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === messageId);
      if (idx === -1) return prev;
      return prev.slice(0, idx + 1).map(m => (m.id === messageId ? { ...m, failed: false } : m));
    });
    await sendMessage(target.content);
  }, [messages, sendMessage]);

  const clearChat = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      await apiFetch(`/api/advisor/session/${sid}`, { method: 'DELETE' });
      setMessages([]);
      toast.success('Chat cleared');
    } catch (error) {
      console.error('Clear chat error:', error);
      toast.error('Failed to clear chat');
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
    clearChat,
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
