import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/EnhancedAuthContext';
import { isUUID } from '../utils/validation';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp?: Date;
  failed?: boolean;
}

export function useAdvisorChat() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Create or load advisor session
  useEffect(() => {
    const initializeSession = async () => {
      if (!user?.id || !isUUID(user.id)) {
        setIsLoadingSession(false);
        return;
      }

      try {
        // Check for existing session
        const response = await fetch(`/api/advisor/session?userId=${user.id}`);
        if (response.ok) {
          try {
            const data = await response.json();
            setSessionId(data.sessionId);

            // Load existing messages
            if (data.messages?.length > 0) {
              setMessages(data.messages.map((msg: any) => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.timestamp)
              })));
            }
          } catch (_jsonError) {
            const text = await response.text();
            console.error("Invalid JSON in session response:", text);
            throw new Error("Invalid session response");
          }
        } else {
          // Create new session
          const createResponse = await fetch('/api/advisor/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, title: 'AI Advisor Session' })
          });

          if (createResponse.ok) {
            try {
              const data = await createResponse.json();
              setSessionId(data.sessionId);
            } catch (_jsonError) {
              const text = await createResponse.text();
              console.error("Invalid JSON in create session response:", text);
              throw new Error("Invalid create session response");
            }
          }
        }
      } catch (error) {
        console.error('Session initialization error:', error);
        toast.error('Failed to initialize chat session');
      } finally {
        setIsLoadingSession(false);
      }
    };

    initializeSession();
  }, [user]);

  const sendMessage = useCallback(async (content: string) => {
    if (!sessionId || !isUUID(sessionId) || !user?.id || !isUUID(user.id)) {
      toast.error('Invalid session. Please refresh the page.');
      return;
    }

    if (!content.trim() || isStreaming) return;

    // Optimistic update
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    const attemptSend = async (retriesLeft: number): Promise<void> => {
      try {
        // Abort any existing request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        
        abortControllerRef.current = new AbortController();
        
        const response = await fetch('/api/advisor/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: content.trim(),
            userId: user.id
          }),
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          throw new Error(`Chat failed: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response stream');

        let assistantContent = '';
        const decoder = new TextDecoder();

        while (true) {
          try {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  setIsStreaming(false);
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.error) {
                    throw new Error(parsed.error);
                  }

                  if (parsed.content) {
                    assistantContent += parsed.content;

                    // Update streaming message
                    setMessages(prev => {
                      const last = prev[prev.length - 1];
                      if (last?.role === 'model' && !last.id.startsWith('streaming-')) {
                        // Replace streaming message
                        return [
                          ...prev.slice(0, -1),
                          {
                            id: `streaming-${Date.now()}`,
                            role: 'model',
                            content: assistantContent,
                            timestamp: new Date()
                          }
                        ];
                      } else if (last?.role !== 'model') {
                        // Add new streaming message
                        return [
                          ...prev,
                          {
                            id: `streaming-${Date.now()}`,
                            role: 'model',
                            content: assistantContent,
                            timestamp: new Date()
                          }
                        ];
                      } else {
                        // Update existing streaming message
                        return [
                          ...prev.slice(0, -1),
                          {
                            id: last.id,
                            role: 'model',
                            content: assistantContent,
                            timestamp: new Date()
                          }
                        ];
                      }
                    });
                  }
                } catch (parseError) {
                  console.error('Parse error:', parseError);
                }
              }
            }
          } catch (readError) {
            // If aborted, this is expected
            if (abortControllerRef.current?.signal.aborted) {
              return;
            }
            throw readError;
          }
        }
      } catch (error) {
        // If aborted, don't retry
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        
        if (retriesLeft > 0) {
          // Exponential backoff
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, 2 - retriesLeft)));
          return attemptSend(retriesLeft - 1);
        } else {
          throw error;
        }
      }
    };

    try {
      await attemptSend(2); // 2 retries
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Message failed to send. Please try again.');
      setIsStreaming(false);

      // Mark message as failed instead of removing it
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, failed: true } 
          : msg
      ));
    }
  }, [sessionId, user, isStreaming]);

  const clearChat = useCallback(async () => {
    if (!sessionId) return;

    try {
      await fetch(`/api/advisor/session/${sessionId}`, { method: 'DELETE' });
      setMessages([]);
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
    clearChat
  };
}