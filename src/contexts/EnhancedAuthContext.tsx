import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
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
  subscriptionTier: 'free' | 'strategist' | 'oracle';
  subscriptionExpiresAt?: string | null;
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
  /**
   * Sign out and wait until the auth state has actually settled
   * (user/session/userData cleared) — or the timeout elapses.
   * Used by destructive flows (account deletion) where we need to be
   * sure no stale auth state lingers before navigating.
   */
  signOutAndWait: (timeoutMs?: number) => Promise<void>;
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
  // Mirror userData into a ref so callbacks (especially loadSession) can read
  // the latest value without growing their dependency array — otherwise each
  // userData change would re-create loadSession and re-fire the auth init
  // useEffect, kicking off a fresh getSession round-trip every time.
  const userDataRef = useRef<UserData | null>(null);
  useEffect(() => { userDataRef.current = userData; }, [userData]);

  // In-flight + recent-success dedup for loadUserData. Multiple call sites
  // (loadSession, signInWithEmail, onAuthStateChange SIGNED_IN /
  // TOKEN_REFRESHED, forceRefreshSession) can fire in quick succession for
  // the same user — without dedup we saw 20+ identical SELECTs against the
  // users table on a single sign-in. We keep both:
  //   • An "in-flight" map: returns the same Promise for concurrent callers.
  //   • A "recently-loaded" timestamp: skips a redundant fetch if the
  //     same user was loaded within FRESH_USER_DATA_MS.
  const inFlightUserLoadRef = useRef<Map<string, Promise<void>>>(new Map());
  const lastUserLoadAtRef = useRef<Map<string, number>>(new Map());
  const FRESH_USER_DATA_MS = 30_000;
  // Retry budget tuned to fit inside the 8s safety timer below. Two
  // retries with exponential backoff (1s, 2s) caps wall-clock at ~3s plus
  // network time, leaving room for the initial getSession() call.
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 1000;

  const wrapUser = (supabaseUser: User | null): ExtendedUser | null => {
    if (!supabaseUser) return null;
    return {
      ...supabaseUser,
      photoURL: supabaseUser.user_metadata?.avatar_url || null,
      displayName: supabaseUser.user_metadata?.display_name || null,
    } as ExtendedUser;
  };

  const loadUserData = useCallback(async (userId: string) => {
    // Dedup: if the same user was already loaded within FRESH_USER_DATA_MS,
    // reuse that result. If a load is already in flight, return that
    // promise. Without this, sign-in spins up 5+ identical fetches because
    // signInWithEmail, loadSession, onAuthStateChange all chain into here.
    const now = Date.now();
    const lastLoadAt = lastUserLoadAtRef.current.get(userId) ?? 0;
    if (now - lastLoadAt < FRESH_USER_DATA_MS && userDataRef.current?.id === userId) {
      return;
    }
    const existing = inFlightUserLoadRef.current.get(userId);
    if (existing) return existing;

    const fetchPromise = (async () => {
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
            lastLoginAt: data.last_login_at,
            // Default to 'free' if column doesn't exist yet (pre-migration safety).
            subscriptionTier: data.subscription_tier ?? 'free',
            subscriptionExpiresAt: data.subscription_expires_at ?? null,
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
                photo_url: null,
              });
            if (insertError) {
              console.error('Failed to create user record:', insertError);
              setUserData(null);
            } else {
              console.log('User record created successfully for:', userId);
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
                  lastLoginAt: newData.last_login_at,
                  subscriptionTier: newData.subscription_tier ?? 'free',
                  subscriptionExpiresAt: newData.subscription_expires_at ?? null,
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
        lastUserLoadAtRef.current.set(userId, Date.now());
      } catch (error) {
        console.error('Unexpected error loading user data:', error);
        setUserData(null);
      } finally {
        inFlightUserLoadRef.current.delete(userId);
      }
    })();

    inFlightUserLoadRef.current.set(userId, fetchPromise);
    return fetchPromise;
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
        // Sync email from Supabase auth to users table (fire and forget).
        // Skipped when local userData already has the right email — avoids
        // a redundant write on every page load. The trigger added in
        // 20240101000400 still allows id/email updates; only role and
        // subscription_tier are pinned.
        const userEmail = data.session.user?.email;
        if (userEmail && userDataRef.current?.email !== userEmail) {
          supabase
            .from('users')
            .upsert({ id: data.session.user.id, email: userEmail }, { ignoreDuplicates: false })
            .then(({ error: upsertErr }) => {
              if (upsertErr) console.error('Email sync failed:', upsertErr);
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
        // Clear the loadUserData dedup caches so a different user signing
        // in next doesn't get a stale "skipped, recently loaded" hit.
        inFlightUserLoadRef.current.clear();
        lastUserLoadAtRef.current.clear();
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

  // Refresh user data when the tab regains focus or visibility. The
  // cached userData (including tier) can go stale if the user upgraded
  // their subscription in another tab, or if a Stripe webhook updated
  // their row server-side while this tab was hidden. The server-side
  // tier cache TTL is 30s, so we refresh here only when the tab has
  // been hidden for at least that long — quick task-switches don't
  // trigger a fetch.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let lastHiddenAt = 0;
    const TIER_REFRESH_THRESHOLD_MS = 30_000;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAt = Date.now();
        return;
      }
      if (document.visibilityState !== 'visible') return;
      if (!user?.id) return;
      // Only refresh if the tab has been backgrounded long enough that
      // the cached tier could plausibly be stale.
      if (lastHiddenAt > 0 && Date.now() - lastHiddenAt < TIER_REFRESH_THRESHOLD_MS) {
        return;
      }
      lastHiddenAt = 0;
      // Bypass the recent-success cache by clearing the timestamp before
      // invoking loadUserData. This forces a re-read so a Stripe-driven
      // tier change from another device shows up here within one tab
      // focus.
      lastUserLoadAtRef.current.delete(user.id);
      loadUserData(user.id).catch(err => {
        console.error('Background tier refresh on tab focus failed:', err);
      });
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [user, loadUserData]);

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

  /**
   * Sign out and resolve only after the SIGNED_OUT auth event has
   * propagated (or the timeout fires). Destructive flows like account
   * deletion need this to avoid racing the redirect against the auth
   * listener — without it, navigate('/') sometimes ran while user was
   * still truthy, and the route guard re-rendered into a logged-in
   * state for a frame.
   *
   * Implementation: we register a one-shot listener BEFORE calling
   * supabase.auth.signOut, so we never miss the SIGNED_OUT event even
   * if it fires synchronously on the same tick.
   */
  const signOutAndWait = useCallback(async (timeoutMs = 2500) => {
    let resolved = false;
    let unsubscribe: (() => void) | null = null;

    const settled = new Promise<void>((resolve) => {
      const listener = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT' && !resolved) {
          resolved = true;
          listener.data.subscription.unsubscribe();
          resolve();
        }
      });
      unsubscribe = () => listener.data.subscription.unsubscribe();
    });

    try {
      await signOut();
    } catch {
      // even if signOut threw, wait briefly in case the event still fires
    }

    // If we already cleared local state in the SIGNED_OUT handler, this
    // resolves immediately. Otherwise wait up to timeoutMs.
    await Promise.race([
      settled,
      new Promise<void>((resolve) => setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (unsubscribe) unsubscribe();
        }
        resolve();
      }, timeoutMs)),
    ]);
  }, []);

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
    signOutAndWait,
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
