import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useSessionWithRetry } from '../hooks/useSessionWithRetry';

// Security logging utility
const logSecurityEvent = async (event: string, userId?: string, email?: string | null, details?: Record<string, unknown>) => {
  try {
    await fetch('/api/security/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        userId,
        email,
        ip: 'client-side', // Actual IP logged server-side
        userAgent: navigator.userAgent,
        details,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    // Silently fail - logging shouldn't break user experience
    console.debug('Security log failed:', err);
  }
};

// Supabase User type compatibility
interface SupabaseUser {
  id: string;
  email: string | null;
  user_metadata: {
    display_name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
  displayName?: string;
  photoURL?: string;
}

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

interface AuthContextType {
  user: SupabaseUser | null;
  userData: UserData | null;
  loading: boolean;
  error: string | null;
  retrySession: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string, recaptchaToken?: string | null) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string, recaptchaToken?: string | null) => Promise<{ requiresVerification: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: { displayName?: string, photoURL?: string }) => Promise<void>;
  updateUserData: (data: Partial<UserData>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userData, setUserData] = useState<UserData | null>(null);

  // Use the retry hook for session management
  const { user: sessionUser, loading: sessionLoading, error: sessionError, retry: retrySession } = useSessionWithRetry({
    maxRetries: 3,
    retryDelay: 2000,
    timeout: 10000
  });

  // Convert Supabase user to our interface
  const user = sessionUser ? {
    id: sessionUser.id,
    email: sessionUser.email,
    user_metadata: sessionUser.user_metadata || {},
    displayName: sessionUser.user_metadata?.display_name,
    photoURL: sessionUser.user_metadata?.avatar_url
  } : null;

  const loading = sessionLoading;

  // Safety timeout as fallback
  useEffect(() => {
    if (sessionError) {
      console.error('Session loading failed after retries:', sessionError);
      // Could show a retry button or error message to user
    }
  }, [sessionError]);

  const loadUserData = useCallback(async (userId: string) => {
    try {
      console.log('Loading user data for:', userId);
      // Use .maybeSingle() to avoid errors when user profile doesn't exist yet (new users)
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
        // Map database snake_case to application camelCase
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
        // Normal case: user exists in auth but no profile record created yet
        console.log('No profile record found for user:', userId);
        setUserData(null);
      }
    } catch (error) {
      console.error('Unexpected error loading user data:', error);
      setUserData(null);
    }
  }, []);

  // Load user data when session user changes
  useEffect(() => {
    if (sessionUser?.id) {
      loadUserData(sessionUser.id);
    } else {
      setUserData(null);
    }
  }, [sessionUser?.id, loadUserData]);

  // Detect if running in embedded WebView
  const isEmbeddedWebView = () => {
    const ua = navigator.userAgent || '';
    // Check for common WebView indicators
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

  const signInWithGoogle = async () => {
    try {
      // Check if running in embedded WebView first
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
      
      // Handle specific disallowed_useragent error
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

  const signInWithEmail = async (email: string, password: string, recaptchaToken?: string | null) => {
    try {
      const signInOptions: { email: string; password: string; options?: { captchaToken?: string } } = {
        email,
        password
      };

      if (recaptchaToken) {
        signInOptions.options = { captchaToken: recaptchaToken };
      }

      const { error } = await supabase.auth.signInWithPassword(signInOptions);
      if (error) throw error;

      // Log successful login
      await logSecurityEvent('login_success', user?.id, email, { email });
    } catch (error: any) {
      console.error('Email sign in error:', error);
      toast.error(error.message || 'Failed to sign in');
      // Log failed login attempt
      await logSecurityEvent('login_failed', undefined, email, {
        error: error.message,
        email,
        captchaUsed: !!recaptchaToken
      });
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name: string, recaptchaToken?: string | null) => {
    try {
      const signUpOptions: { email: string; password: string; options?: { data?: { display_name?: string }; captchaToken?: string } } = {
        email,
        password,
        options: {
          data: {
            display_name: name
          }
        }
      };

      if (recaptchaToken) {
        signUpOptions.options!.captchaToken = recaptchaToken;
      }

      const { data, error } = await supabase.auth.signUp(signUpOptions);

      if (error) throw error;

      // Log signup attempt
      await logSecurityEvent('signup_attempt', data.user?.id, email, {
        name,
        requiresVerification: !data.user?.email_confirmed_at
      });

      // Create user record in database
      if (data.user) {
        try {
          await supabase
            .from('users')
            .insert({
              uid: data.user.id,
              email: data.user.email,
              display_name: name,
              photo_url: data.user.user_metadata?.avatar_url || null
            });
        } catch (insertError) {
          console.error('Error creating user record:', insertError);
        }
      }

      if (data.user && !data.user.email_confirmed_at) {
        toast.success('Check your email for verification link');
        return { requiresVerification: true };
      }

      return { requiresVerification: false };
    } catch (error: any) {
      console.error('Email sign up error:', error);
      toast.error(error.message || 'Failed to sign up');
      // Log failed signup
      await logSecurityEvent('signup_failed', undefined, email, {
        error: error.message,
        name
      });
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://epimetheusproject.vercel.app/reset-password'
      });
      if (error) throw error;
      toast.success('Password reset email sent');
      // Log password reset request
      await logSecurityEvent('password_reset_requested', undefined, email);
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error('Failed to send reset email');
      await logSecurityEvent('password_reset_failed', undefined, email, {
        error: error.message
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Signed out successfully');
      // Log logout
      await logSecurityEvent('logout', user?.id, user?.email);
    } catch (error: any) {
      console.error('Logout error:', error);
      toast.error('Failed to sign out');
      await logSecurityEvent('logout_failed', user?.id, user?.email, {
        error: error.message
      });
      throw error;
    }
  };

  const updateUserProfile = async (data: { displayName?: string, photoURL?: string }) => {
    if (!user) return;

    try {
      // Update auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: data.displayName,
          avatar_url: data.photoURL
        }
      });

      if (authError) throw authError;

      // Update database users table
      const { error: dbError } = await supabase
        .from('users')
        .update({
          display_name: data.displayName,
          photo_url: data.photoURL
        })
        .eq('uid', user.id);

      if (dbError) throw dbError;

      // Update userData state
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
      // Map application camelCase to database snake_case
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

      // Update userData state
      setUserData(prev => prev ? { ...prev, ...data } : null);

      toast.success('Profile updated');
    } catch (error: any) {
      console.error('User data update error:', error);
      toast.error('Failed to update profile');
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userData,
      loading,
      error: sessionError,
      retrySession: retrySession,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      resetPassword,
      logout,
      updateUserProfile,
      updateUserData
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
