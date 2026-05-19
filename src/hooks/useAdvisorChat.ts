import { useState, useEffect, useCallback, useRef } from 'react';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { isUUID } from '../utils/validation';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp?: Date;
  failed?: boolean;
}

/**
 * Parses an error response body into a human-readable message. Falls back to
 * status text when the body is not JSON.
 */
async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = await response.clone().json();
    return data?.error || data?.details || `HTTP ${response.status}`;
  } catch {
    try {
      const text = await response.text();
      return text.slice(0, 200) || `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }
}

export function useAdvisorChat() {
  const { user } = useEnhancedAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup any in-flight request on unmount.
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Create or load advisor session.
  useEffect(() => {
    const initializeSession = async () => {
      if (!user?.id || !isUUID(user.id)) {
        setIsLoadingSession(false);
        return;
      }

      try {
        const response = await fetch(`/api/advisor/session?userId=${user.id}`);

        if (response.ok) {
          const data = await response.json();
          if (data.sessionId) {
            setSessionId(data.sessionId);
            if (Array.isArray(data.messages) && data.messages.length > 0) {
              setMessages(
                data.messages.map((msg: any) => ({
                  id: msg.id,
                  role: msg.role,
                  content: msg.content,
                  timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined
                }))
              );
            }
            return;
          }
        }

        // Either no existing session or fetch failed; create a fresh one.
        const createResponse = await fetch('/api/advisor/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, title: 'AI Advisor Session' })
        });

        if (!createResponse.ok) {
          const errMsg = await parseErrorResponse(createResponse);
          throw new Error(errMsg);
        }

        const data = await createResponse.json();
        setSessionId(data.sessionId);
      } catch (error) {
        console.error('Session initialization error:', error);
        toast.error('Failed to initialize chat session. Try refreshing.');
      } finally {
        setIsLoadingSession(false);
      }
    };

    initializeSession();
  }, [user]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || !isUUID(sessionId) || !user?.id || !isUUID(user.id)) {
        toast.error('Invalid session. Please refresh the page.');
        return;
      }

      const trimmed = content.trim();
      if (!trimmed || isStreaming) return;

      // Optimistic user message render.
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, userMessage]);
      setIsStreaming(true);

      const attemptSend = async (retriesLeft: number): Promise<void> => {
        // Abort any prior in-flight request before starting a new one.
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const response = await fetch('/api/advisor/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: trimmed,
            userId: user.id
          }),
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          const errMsg = await parseErrorResponse(response);

          // 5xx is worth retrying; 4xx is a client problem and should not be.
          const isRetryable = response.status >= 500 && retriesLeft > 0;
          if (isRetryable) {
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, 2 - retriesLeft)));
            return attemptSend(retriesLeft - 1);
          }

          throw new Error(errMsg);
        }

        const data = await response.json();
        const assistantContent: string = data?.content?.trim() || '';
        if (!assistantContent) {
          throw new Error('Empty response from advisor');
        }

        const assistantMessage: Message = {
          id: `model-${Date.now()}`,
          role: 'model',
          content: assistantContent,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
      };

      try {
        await attemptSend(2);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Chat error:', error);
        toast.error(`Message failed: ${errMsg}`);

        // Mark the optimistic user message as failed so the user can retry.
        setMessages(prev =>
          prev.map(msg => (msg.id === userMessage.id ? { ...msg, failed: true } : msg))
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [sessionId, user, isStreaming]
  );

  const clearChat = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/advisor/session/${sessionId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const errMsg = await parseErrorResponse(response);
        throw new Error(errMsg);
      }
      setMessages([]);
      setSessionId(null);
      toast.success('Chat cleared');
    } catch (error) {
      console.error('Clear chat error:', error);
      toast.error('Failed to clear chat');
    }
  }, [sessionId]);

  return {
    messages,
    sendMessage,
    isStreaming,
    isLoadingSession,
    sessionId,
    clearChat,
    setMessages
  };
}
