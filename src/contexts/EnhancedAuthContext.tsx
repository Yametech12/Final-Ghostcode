import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { serializeError } from '../utils/errorHandling';

interface EnhancedAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signInWithEmail: (email: string, password: string, recaptchaToken?: string | null) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ user: User | null; session: Session | null; }>;
  signOut: () => Promise<void>;
  retrySession: () => Promise<void>;
  forceRefreshSession: () => Promise<void>;
}

const EnhancedAuthContext = createContext<EnhancedAuthContextType | undefined>(undefined);

export function EnhancedAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const loadSession = useCallback(async (retry = 0): Promise<Session | null> => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        setError(null);
        return data.session;
      }
      return null;
    } catch (err: any) {
      console.error('Session load error:', serializeError(err));
      if (retry < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retry)));
        return loadSession(retry + 1);
      }
      setError('Failed to load session. Please refresh.');
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await loadSession();
      if (mounted) setLoading(false);
    };
    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setError(null);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadSession]);

  const retrySession = useCallback(async () => {
    setLoading(true);
    setError(null);
    await loadSession();
    setLoading(false);
  }, [loadSession]);

  const forceRefreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      setSession(data.session);
      setUser(data.session?.user ?? null);
    } catch (err) {
      console.error('Force refresh failed:', serializeError(err));
    }
  }, []);

  const signInWithEmail = async (email: string, password: string, recaptchaToken?: string | null) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: recaptchaToken ? { captchaToken: recaptchaToken } : undefined
    });
    if (error) throw error;
    setSession(data.session);
    setUser(data.session.user);
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName }
      }
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    // Force clear all storage
    localStorage.clear();
    sessionStorage.clear();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    // Clear any cached state
    window.location.href = '/';
  };

  const value = {
    user,
    session,
    loading,
    error,
    signInWithEmail,
    signUp,
    signOut,
    retrySession,
    forceRefreshSession
  };

  return (
    <EnhancedAuthContext.Provider value={value}>
      {children}
    </EnhancedAuthContext.Provider>
  );
}

export const useEnhancedAuth = () => {
  const context = useContext(EnhancedAuthContext);
  if (!context) throw new Error('useEnhancedAuth must be used within EnhancedAuthProvider');
  return context;
};