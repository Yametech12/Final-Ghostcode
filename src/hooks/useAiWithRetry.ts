import { useState, useCallback } from 'react';
import { serializeError } from '../utils/errorHandling';

interface UseAiWithRetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export function useAiWithRetry({
  maxRetries = 2,
  retryDelay = 1000,
  onRetry
}: UseAiWithRetryOptions = {}) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const sendMessage = useCallback(async (messages: any[], userId?: string) => {
    setIsRetrying(false);
    setError(null);
    setRetryCount(0);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('/api/advisor/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, userId }),
        });

        if (response.ok) {
          setRetryCount(attempt);
          return await response.json();
        }

        // Check if it's a retryable error
        const isRetryable = response.status === 500 ||
                           response.status === 502 ||
                           response.status === 503 ||
                           response.status === 504;

        if (!isRetryable || attempt === maxRetries) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // Wait before retrying with exponential backoff
        setIsRetrying(true);
        setRetryCount(attempt + 1);
        onRetry?.(attempt + 1, new Error(`HTTP ${response.status}`));

        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Network error';

        if (attempt === maxRetries) {
          setError(`AI service is temporarily unavailable. ${errorMessage}`);
          throw err;
        }

        // Wait before retrying
        setIsRetrying(true);
        setRetryCount(attempt + 1);
        onRetry?.(attempt + 1, err instanceof Error ? err : new Error(errorMessage));

        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }, [maxRetries, retryDelay, onRetry]);

  const reset = useCallback(() => {
    setIsRetrying(false);
    setError(null);
    setRetryCount(0);
  }, []);

  return {
    sendMessage,
    isRetrying,
    error,
    retryCount,
    reset
  };
}