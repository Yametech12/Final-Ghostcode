import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

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
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ requiresVerification: boolean }>;
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Email sign in error:', error);
      toast.error(error.message || 'Failed to sign in');
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name
          }
        }
      });

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
        redirectTo: 'https://epimetheusproject.vercel.app/reset-password'
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
      toast.success('Signed out successfully');
    } catch (error: any) {
      console.error('Logout error:', error);
      toast.error('Failed to sign out');
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