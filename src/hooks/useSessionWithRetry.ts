import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface UseSessionWithRetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

interface UseSessionWithRetryReturn {
  session: any;
  user: any;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useSessionWithRetry(options: UseSessionWithRetryOptions = {}): UseSessionWithRetryReturn {
  const {
    maxRetries = 3,
    retryDelay = 2000,
    timeout = 10000
  } = options;

  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const loadSession = useCallback(async (isRetry = false) => {
    try {
      if (isRetry) {
        setLoading(true);
        setError(null);
        console.log(`Retrying session load (attempt ${retryCount + 1}/${maxRetries})`);
      }

      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Session loading timeout')), timeout);
      });

      const { data: { session: newSession }, error: sessionError } = await Promise.race([
        sessionPromise,
        timeoutPromise
      ]) as any;

      if (sessionError) throw sessionError;

      setSession(newSession);
      setUser(newSession?.user || null);
      setError(null);
      setRetryCount(0); // Reset retry count on success

    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load session';

      console.error(`Session load failed (attempt ${retryCount + 1}):`, errorMessage);

      if (errorMessage.includes('timeout') && retryCount < maxRetries - 1) {
        // Retry on timeout
        setRetryCount(prev => prev + 1);
        setTimeout(() => loadSession(true), retryDelay);
        return;
      }

      // Final failure
      setError(errorMessage);
      toast.error(`Session loading failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [maxRetries, retryDelay, timeout, retryCount]);

  const retry = useCallback(() => {
    setRetryCount(0);
    setError(null);
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    loadSession();
  }, [loadSession]); // Only run once on mount

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state changed:', event, newSession?.user?.id);
        setSession(newSession);
        setUser(newSession?.user || null);
        setError(null);
        setRetryCount(0);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return {
    session,
    user,
    loading,
    error,
    retry
  };
}