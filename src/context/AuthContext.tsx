import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

// Security logging utility
const logSecurityEvent = async (event: string, userId?: string, email?: string | null, details?: Record<string, any>) => {
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
  createdAt: any;
  lastLoginAt?: any;
}

interface AuthContextType {
  user: SupabaseUser | null;
  userData: UserData | null;
  loading: boolean;
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
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const supabaseUser: SupabaseUser = {
          id: session.user.id,
          email: session.user.email,
          user_metadata: session.user.user_metadata || {},
          displayName: session.user.user_metadata?.display_name,
          photoURL: session.user.user_metadata?.avatar_url
        };
        setUser(supabaseUser);
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const supabaseUser: SupabaseUser = {
          id: session.user.id,
          email: session.user.email,
          user_metadata: session.user.user_metadata || {},
          displayName: session.user.user_metadata?.display_name,
          photoURL: session.user.user_metadata?.avatar_url
        };
        setUser(supabaseUser);
        await loadUserData(session.user.id);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('uid', userId)
        .single();

      if (data && !error) {
        setUserData(data);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://epimetheusproject.vercel.app'
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

  const updateUserData = async (data: Partial<UserData>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('users')
        .update(data)
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