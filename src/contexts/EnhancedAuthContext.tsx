import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { serializeError } from '../utils/errorHandling';
import { toast } from 'sonner';

interface UserData {
  uid: string;
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
  user: User | null;
  session: Session | null;
  userData: UserData | null;
  loading: boolean;
  error: string | null;
  signInWithEmail: (email: string, password: string, recaptchaToken?: string | null) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, displayName?: string, recaptchaToken?: string | null) => Promise<{ user: User | null; session: Session | null; }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: { displayName?: string, photoURL?: string }) => Promise<void>;
  updateUserData: (data: Partial<UserData>) => Promise<void>;
  retrySession: () => Promise<void>;
  forceRefreshSession: () => Promise<void>;
}

const EnhancedAuthContext = createContext<EnhancedAuthContextType | undefined>(undefined);

export function EnhancedAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  const loadUserData = useCallback(async (userId: string) => {
    try {
      console.log('Loading user data for:', userId);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('uid', userId)
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
        console.log('No profile record found for user:', userId);
        setUserData(null);
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
        setUser(data.session.user);
        setError(null);
        await loadUserData(data.session.user.id);
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
        if (newSession?.user?.id) {
          await loadUserData(newSession.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setUserData(null);
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

  const signUp = async (email: string, password: string, displayName?: string, recaptchaToken?: string | null) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          ...(recaptchaToken ? { captchaToken: recaptchaToken } : {})
        }
      });

      if (error) throw error;

      if (data.user) {
        try {
          await supabase
            .from('users')
            .insert({
              uid: data.user.id,
              email: data.user.email,
              display_name: displayName,
              photo_url: data.user.user_metadata?.avatar_url || null
            });
        } catch (insertError) {
          console.error('Error creating user record:', insertError);
        }
      }

      if (data.user && !data.user.email_confirmed_at) {
        toast.success('Check your email for verification link');
      }

      return data;
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
    setSession(null);
    setUser(null);
    setUserData(null);
    // Force clear all storage
    localStorage.clear();
    sessionStorage.clear();
    // Clear any cached state
    window.location.href = '/';
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password' || 'https://epimetheusproject.vercel.app/reset-password'
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
        .eq('uid', user.id);

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
        .eq('uid', user.id);

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

export const useAuth = () => {
  const context = useContext(EnhancedAuthContext);
  if (!context) throw new Error('useAuth must be used within EnhancedAuthProvider');
  return context;
};
