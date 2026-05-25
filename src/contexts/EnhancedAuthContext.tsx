import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { serializeError } from '../utils/errorHandling';
import { setUser as setSentryUser, clearUser as clearSentryUser } from '../lib/sentry';
import { toast } from 'sonner';

// Extended User type with metadata properties
type ExtendedUser = User & {
  photoURL: string | null;
  displayName: string | null;
};

interface UserData {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  bio?: string;
  contactInfo?: {
    phone?: string;
    instagram?: string;
    twitter?: string;
  };
  role: 'user' | 'admin';
  createdAt: string;
  lastLoginAt?: string;
}

interface EnhancedAuthContextType {
  user: ExtendedUser | null;
  session: Session | null;
  userData: UserData | null;
  loading: boolean;
  error: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ requiresVerification: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: { displayName?: string, photoURL?: string }) => Promise<void>;
  updateUserData: (data: Partial<UserData>) => Promise<void>;
  retrySession: () => Promise<void>;
  forceRefreshSession: () => Promise<void>;
}

const EnhancedAuthContext = createContext<EnhancedAuthContextType | undefined>(undefined);

export function EnhancedAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const wrapUser = (supabaseUser: User | null): ExtendedUser | null => {
    if (!supabaseUser) return null;
    return {
      ...supabaseUser,
      photoURL: supabaseUser.user_metadata?.avatar_url || null,
      displayName: supabaseUser.user_metadata?.display_name || null,
    } as ExtendedUser;
  };

  const loadUserData = useCallback(async (userId: string) => {
    try {
      console.log('Loading user data for:', userId);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Database error loading user data:', error.message, error.code);
        setUserData(null);
        return;
      }

      if (data) {
        console.log('User data loaded successfully:', data);
        const mappedData = {
          ...data,
          displayName: data.display_name,
          photoURL: data.photo_url,
          contactInfo: data.contact_info,
          createdAt: data.created_at,
          lastLoginAt: data.last_login_at
        };
        setUserData(mappedData);
      } else {
        // Attempt to create the user record if it doesn't exist
        try {
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: userId,
              email: null, // will be updated on next session refresh if available
              display_name: null,
              photo_url: null
            });
          if (insertError) {
            console.error('Failed to create user record:', insertError);
            setUserData(null);
          } else {
            console.log('User record created successfully for:', userId);
            // Reload user data to populate state
            const { data: newData } = await supabase
              .from('users')
              .select('*')
              .eq('id', userId)
              .maybeSingle();
            if (newData) {
              setUserData({
                ...newData,
                displayName: newData.display_name,
                photoURL: newData.photo_url,
                contactInfo: newData.contact_info,
                createdAt: newData.created_at,
                lastLoginAt: newData.last_login_at
              });
            } else {
              setUserData(null);
            }
          }
        } catch (createErr) {
          console.error('Error creating user record:', createErr);
          setUserData(null);
        }
      }
    } catch (error) {
      console.error('Unexpected error loading user data:', error);
      setUserData(null);
    }
  }, []);

  const loadSession = useCallback(async (retry = 0): Promise<Session | null> => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session) {
        setSession(data.session);
        setUser(wrapUser(data.session.user));
        setError(null);
        // Run loadUserData in parallel with completing the session load
        loadUserData(data.session.user.id).catch(err =>
          console.error('Background user data load failed:', err)
        );
        // Sync email from Supabase auth to users table (fire and forget)
        const userEmail = data.session.user?.email;
        if (userEmail) {
          supabase
            .from('users')
            .upsert({ id: data.session.user.id, email: userEmail }, { ignoreDuplicates: false })
            .then(({ error: upsertErr }) => {
              if (upsertErr) console.error('Email sync failed:', upsertErr);
              else console.log('Email synced to users table:', userEmail);
            });
        }
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
  }, [loadUserData]);

  useEffect(() => {
    let mounted = true;
    let initialized = false;

    const init = async () => {
      if (initialized) return;
      initialized = true;
      try {
        await loadSession();
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        // Always clear loading — even if session load fails.
        if (mounted) setLoading(false);
      }
    };

    init();

    // Hard safety net: if loading is still true after 8s, force it off.
    // This prevents the app from being permanently stuck on the loading screen.
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn('Auth loading timed out after 8s — forcing loading=false');
        setLoading(false);
      }
    }, 8000);

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        setUser(wrapUser(newSession?.user ?? null));
        setError(null);
        // Always clear loading on auth state change too
        setLoading(false);
        if (newSession?.user?.id) {
          // Set Sentry user context for error tracking
          setSentryUser({ id: newSession.user.id, email: newSession.user.email });
          loadUserData(newSession.user.id).catch(err =>
            console.error('Background user data load failed:', err)
          );
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setUserData(null);
        setLoading(false);
        // Clear Sentry user context on sign out
        clearSentryUser();
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
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
      setUser(wrapUser(data.session?.user ?? null));
      if (data.session?.user?.id) {
        await loadUserData(data.session.user.id);
      }
    } catch (err) {
      console.error('Force refresh failed:', serializeError(err));
    }
  }, [loadUserData]);

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    setSession(data.session);
    setUser(wrapUser(data.session.user));
    if (data.session.user?.id) {
      await loadUserData(data.session.user.id);
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName }
        }
      });

      if (error) throw error;

      if (data.user) {
        try {
          await supabase
            .from('users')
            .insert({
              id: data.user.id,
              email: data.user.email,
              display_name: displayName,
              photo_url: data.user.user_metadata?.avatar_url || null
            });
        } catch (insertError) {
          console.error('Error creating user record:', insertError);
        }
      }

      return { requiresVerification: !data.user?.email_confirmed_at };
    } catch (error: any) {
      console.error('Email sign up error:', error);
      toast.error(error.message || 'Failed to sign up');
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Signed out successfully');
    } catch (error: any) {
      console.error('Logout error:', error);
      toast.error('Failed to sign out');
      throw error;
    }
    // Clear React state — the onAuthStateChange SIGNED_OUT event also does this,
    // but we do it here too for immediate UI feedback.
    setSession(null);
    setUser(null);
    setUserData(null);
    // Do NOT call localStorage.clear() — it wipes Supabase's own auth token
    // before signOut() can clean it up properly, causing race conditions.
  };

  const resetPassword = async (email: string) => {
    try {
      // window.location.origin is reliably set in any browser context, so use
      // it directly. The previous expression `origin + '/reset-password' || fallback`
      // never reached the fallback because the left side is always a truthy string.
      const redirectTo =
        (typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : 'https://epimetheusproject.vercel.app') + '/reset-password';
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;
      toast.success('Password reset email sent');
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error('Failed to send reset email');
      throw error;
    }
  };

  const updateUserProfile = async (data: { displayName?: string, photoURL?: string }) => {
    if (!user) return;

    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: data.displayName,
          avatar_url: data.photoURL
        }
      });

      if (authError) throw authError;

      const { error: dbError } = await supabase
        .from('users')
        .update({
          display_name: data.displayName,
          photo_url: data.photoURL
        })
        .eq('id', user.id);

      if (dbError) throw dbError;

      if (userData) {
        setUserData({ ...userData, ...data });
      }

      toast.success('Profile updated');
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
      throw error;
    }
  };

  const updateUserData = async (data: Partial<UserData>) => {
    if (!user) return;

    try {
      const dbData: Record<string, any> = {};
      if (data.displayName !== undefined) dbData.display_name = data.displayName;
      if (data.photoURL !== undefined) dbData.photo_url = data.photoURL;
      if (data.bio !== undefined) dbData.bio = data.bio;
      if (data.contactInfo !== undefined) dbData.contact_info = data.contactInfo;
      if (data.lastLoginAt !== undefined) dbData.last_login_at = data.lastLoginAt;

      const { error } = await supabase
        .from('users')
        .update(dbData)
        .eq('id', user.id);

      if (error) throw error;

      setUserData(prev => prev ? { ...prev, ...data } : null);

      toast.success('Profile updated');
    } catch (error: any) {
      console.error('User data update error:', error);
      toast.error('Failed to update profile');
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    const isEmbeddedWebView = () => {
      const ua = navigator.userAgent || '';
      return (
        ua.includes('wv') ||
        ua.includes('WebView') ||
        ua.includes('Instagram') ||
        ua.includes('FBAN') ||
        ua.includes('FBAV') ||
        ua.includes('LinkedInApp') ||
        ua.includes('Twitter') ||
        ua.includes('Line/') ||
        (ua.includes('Android') && !ua.includes('Chrome')) ||
        (ua.includes('iPhone') && !ua.includes('Safari'))
      );
    };

    try {
      if (isEmbeddedWebView()) {
        toast.error(
          'Google sign-in is blocked in embedded browsers. Please open this website in Chrome, Safari, or your device\'s default browser.',
          { duration: 10000 }
        );
        throw new Error('Google OAuth not supported in embedded WebView');
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin || 'https://epimetheusproject.vercel.app',
          skipBrowserRedirect: false
        }
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Google sign in error:', error);

      if (error.message?.includes('disallowed_useragent') || error.code === 'disallowed_useragent') {
        toast.error(
          'Google sign-in is blocked in this browser. Please open this website in your device\'s default browser (Chrome/Safari) and try again.',
          { duration: 10000 }
        );
      } else {
        toast.error(error.message || 'Failed to sign in with Google');
      }

      throw error;
    }
  };

  const value = {
    user,
    session,
    userData,
    loading,
    error,
    signInWithEmail,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    updateUserProfile,
    updateUserData,
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
