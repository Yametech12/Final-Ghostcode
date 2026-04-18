import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useSessionWithRetry } from '../hooks/useSessionWithRetry';

interface EnhancedAuthContextType {
  // Session state
  user: any;
  userData: any;
  session: any;
  loading: boolean;
  error: string | null;

  // Auth methods
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string, recaptchaToken?: string | null) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string, recaptchaToken?: string | null) => Promise<{ requiresVerification: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: { displayName?: string, photoURL?: string }) => Promise<void>;
  updateUserData: (data: Partial<any>) => Promise<void>;

  // Session management
  retrySession: () => void;
  forceRefreshSession: () => Promise<void>;
  clearSession: () => void;
}

const EnhancedAuthContext = createContext<EnhancedAuthContextType | undefined>(undefined);

export function EnhancedAuthProvider({ children }: { children: React.ReactNode }) {
  const [userData, setUserData] = useState<any>(null);
  const [sessionRefreshCount, setSessionRefreshCount] = useState(0);

  // Use our enhanced session hook
  const { session, user: sessionUser, loading: sessionLoading, error: sessionError, retry: retrySession } = useSessionWithRetry({
    maxRetries: 3,
    retryDelay: 2000,
    timeout: 15000 // Increased timeout
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
  const error = sessionError;

  // Enhanced user data loading with error handling
  const loadUserData = useCallback(async (userId: string) => {
    try {
      console.log('Loading user data for:', userId);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('uid', userId)
        .single();

      if (data && !error) {
        console.log('User data loaded successfully:', data);
        setUserData(data);
      } else if (error?.code === 'PGRST116') {
        // User not found in database, create profile
        console.log('User not found in database, creating profile...');
        await createUserProfile(userId, sessionUser);
      } else {
        console.warn('Failed to load user data:', error);
        setUserData(null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setUserData(null);
    }
  }, [sessionUser]);

  // Create user profile if it doesn't exist
  const createUserProfile = async (userId: string, userInfo: any) => {
    try {
      const profileData = {
        uid: userId,
        email: userInfo.email,
        display_name: userInfo.user_metadata?.display_name || null,
        photo_url: userInfo.user_metadata?.avatar_url || null,
        role: 'user',
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('users')
        .insert(profileData)
        .select()
        .single();

      if (data && !error) {
        console.log('User profile created:', data);
        setUserData(data);
        toast.success('Profile created successfully');
      } else {
        throw error;
      }
    } catch (error) {
      console.error('Failed to create user profile:', error);
      toast.error('Failed to create profile');
    }
  };

  // Load user data when session user changes
  useEffect(() => {
    if (sessionUser?.id) {
      loadUserData(sessionUser.id);
    } else {
      setUserData(null);
    }
  }, [sessionUser?.id, loadUserData]);

  // Force refresh session
  const forceRefreshSession = useCallback(async () => {
    try {
      setSessionRefreshCount(prev => prev + 1);
      const { data, error } = await supabase.auth.refreshSession();

      if (error) throw error;

      console.log('Session refreshed successfully');
      toast.success('Session refreshed');

    } catch (error) {
      console.error('Failed to refresh session:', error);
      toast.error('Failed to refresh session');
      throw error;
    }
  }, []);

  // Clear session completely
  const clearSession = useCallback(() => {
    try {
      // Clear all auth-related storage
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('supabase') || key.includes('auth')) {
          localStorage.removeItem(key);
        }
      });

      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.includes('supabase') || key.includes('auth')) {
          sessionStorage.removeItem(key);
        }
      });

      setUserData(null);
      console.log('Session cleared');
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }, []);

  // Auth methods (enhanced versions)
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Google sign in error:', error);
      toast.error('Failed to sign in with Google');
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string, recaptchaToken?: string | null) => {
    try {
      const signInOptions: any = { email, password };
      if (recaptchaToken) {
        signInOptions.options = { captchaToken: recaptchaToken };
      }

      const { error } = await supabase.auth.signInWithPassword(signInOptions);
      if (error) throw error;

      toast.success('Signed in successfully');
    } catch (error: any) {
      console.error('Email sign in error:', error);
      toast.error(error.message || 'Failed to sign in');
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name: string, recaptchaToken?: string | null) => {
    try {
      const signUpOptions: any = {
        email,
        password,
        options: {
          data: { display_name: name }
        }
      };

      if (recaptchaToken) {
        signUpOptions.options.captchaToken = recaptchaToken;
      }

      const { data, error } = await supabase.auth.signUp(signUpOptions);

      if (error) throw error;

      if (data.user && !data.user.email_confirmed_at) {
        toast.success('Check your email for verification link');
        return { requiresVerification: true };
      }

      return { requiresVerification: false };
    } catch (error: any) {
      console.error('Email sign up error:', error);
      toast.error(error.message || 'Failed to sign up');
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      toast.success('Password reset email sent');
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error('Failed to send reset email');
      throw error;
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      clearSession();
      toast.success('Signed out successfully');

      // Force redirect
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    } catch (error: any) {
      console.error('Logout error:', error);

      // Force clear even if API fails
      clearSession();

      toast.error('Signed out (with issues)');
      window.location.href = '/login';
      throw error;
    }
  };

  const updateUserProfile = async (data: { displayName?: string, photoURL?: string }) => {
    if (!sessionUser) return;

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: data.displayName,
          avatar_url: data.photoURL
        }
      });

      if (error) throw error;

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

  const updateUserData = async (data: Partial<any>) => {
    if (!sessionUser) return;

    try {
      const { error } = await supabase
        .from('users')
        .update(data)
        .eq('uid', sessionUser.id);

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

  const value: EnhancedAuthContextType = {
    // Session state
    user,
    userData,
    session,
    loading,
    error,

    // Auth methods
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    logout,
    updateUserProfile,
    updateUserData,

    // Session management
    retrySession,
    forceRefreshSession,
    clearSession
  };

  return (
    <EnhancedAuthContext.Provider value={value}>
      {children}
    </EnhancedAuthContext.Provider>
  );
}

export function useEnhancedAuth() {
  const context = useContext(EnhancedAuthContext);
  if (context === undefined) {
    throw new Error('useEnhancedAuth must be used within an EnhancedAuthProvider');
  }
  return context;
}