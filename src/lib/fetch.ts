/// <reference lib="dom" />
/**
 * Reusable fetch utility with proper JSON error handling and automatic
 * Authorization header injection from the active Supabase session.
 *
 * All `/api/*` calls go through `apiFetch` so they include the bearer JWT;
 * the server now requires authentication on AI/advisor/upload endpoints.
 */

import { supabase } from './supabase';
import { toast } from 'sonner';

interface FetchOptions extends RequestInit {
  timeout?: number;
}

/**
 * Get the current Supabase access token (JWT) for authenticating server requests.
 * Uses getSession() which auto-refreshes expired tokens when possible.
 *
 * Returns null when the session is gone OR when a refresh fails — never a
 * token we know is dead. Sending a known-expired JWT just guarantees a 401
 * round-trip and, worse, lets callers mistake "expired session" for a
 * normal API error.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    // getSession() returns the cached session and auto-refreshes if expired.
    // However, if the cached token is expired and refresh fails silently,
    // we may get a stale token. As a safety net, check expiry.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      if (import.meta.env.DEV) {
        console.warn('[apiFetch] No session available:', error?.message || 'session is null');
      }
      return null;
    }

    const { access_token, expires_at } = data.session;

    // If token expires within 60 seconds, force a refresh
    if (expires_at && expires_at * 1000 < Date.now() + 60_000) {
      if (import.meta.env.DEV) {
        console.info('[apiFetch] Token expiring soon, forcing refresh...');
      }
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        console.warn('[apiFetch] Token refresh failed — treating session as expired:', refreshError?.message);
        // Return null, NOT the dead token. Callers see the same shape as
        // "no session" and the 401 path below explains what happened.
        return null;
      }
      return refreshed.session.access_token;
    }

    return access_token;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[apiFetch] Exception getting auth token:', err);
    }
    return null;
  }
}

/**
 * Fetch wrapper for `/api/*` calls. Automatically attaches the Authorization
 * header when a Supabase session exists. Use this in place of `fetch()` for
 * any internal API call.
 */
export async function apiFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // CSRF protection: always include this custom header so the server knows
  // the request came from our app, not a cross-origin form submission.
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'XMLHttpRequest');
  }
  if (import.meta.env.DEV && !token) {
    console.warn('[apiFetch] Sending request WITHOUT auth token to:', typeof input === 'string' ? input : (input as Request).url);
  }
  const response = await fetch(input, { ...init, headers });

  // Session-expiry UX: a 401 from our API means the JWT was rejected
  // (expired/revoked session). React once — per browser tab — so parallel
  // calls don't stack toasts and the redirect loop can't re-fire while the
  // toast is up, then bounce the user to /login to start a clean session.
  if (response.status === 401 && !handled401InThisTab()) {
    mark401Handled();
    console.warn('[apiFetch] 401 received — session expired or invalid. Redirecting to login.');
    toast.error('Your session has expired. Please sign in again.');
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }

  return response;
}

// --- 401 single-fire guard -------------------------------------------------
// Module-scoped, per-tab. sessionStorage survives bfcache restores and soft
// reloads (unlike a module flag, which resets on hard navigation), so the
// "session expired" toast can't double-fire from React StrictMode double
// fetches or parallel calls racing through the same 401.
const SESSION_EXPIRED_FLAG = 'epimetheus:session-expired-redirect';

function handled401InThisTab(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_EXPIRED_FLAG) === '1';
  } catch {
    return false;
  }
}

function mark401Handled(): void {
  try {
    window.sessionStorage.setItem(SESSION_EXPIRED_FLAG, '1');
    // Clear the flag once the redirect lands on /login — a fresh sign-in
    // there must be able to trigger another redirect later if it expires again.
    window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem(SESSION_EXPIRED_FLAG);
      } catch { /* ignore */ }
    }, 3000);
  } catch {
    /* storage unavailable (private mode) — worst case: duplicate toast */
  }
}

/**
 * User-friendly error messages for common fetch failures.
 * Never expose raw status codes, URLs, or response bodies to the user —
 * those go to Sentry via the caller's error handler.
 */
function friendlyFetchError(status: number): string {
  if (status === 400) return 'That request wasn\u2019t quite right. Please check and try again.';
  if (status === 401) return 'Please sign in to continue.';
  if (status === 403) return 'You don\u2019t have access to that right now.';
  if (status === 404) return 'We couldn\u2019t find what you were looking for.';
  if (status === 409) return 'That conflicts with something that already exists.';
  if (status === 422) return 'Please check the highlighted fields and try again.';
  if (status === 429) return 'You\u2019re going a bit fast. Please wait a moment and try again.';
  if (status >= 500) return 'Something went wrong on our end. Please try again in a moment.';
  return 'Something went wrong. Please try again.';
}

export async function fetchWithErrorHandling<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await apiFetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseClone = response.clone();

    if (!response.ok) {
      // Capture the raw server error for diagnostics (Sentry), but throw
      // a user-friendly message for the UI.
      let serverMessage = '';
      try {
        const errorData = await response.json();
        serverMessage = errorData.error || errorData.message || '';
      } catch {
        /* body wasn't JSON — fall through to friendly message */
      }
      // Report technical details to Sentry without console spam.
      import('./sentry').then(({ captureException }) => {
        captureException(new Error(`API ${response.status} ${url}: ${serverMessage.slice(0, 200)}`));
      }).catch(() => { /* ignore */ });
      void responseClone;
      throw new Error(serverMessage || friendlyFetchError(response.status));
    }

    try {
      return (await response.json()) as T;
    } catch {
      // Report the parse failure for diagnostics, show a friendly message.
      import('./sentry').then(({ captureException }) => {
        captureException(new Error(`JSON parse failed for ${url}`));
      }).catch(() => { /* ignore */ });
      void responseClone;
      throw new Error('We had trouble reading the response. Please try again.');
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('That took too long. Please check your connection and try again.');
    }

    throw error;
  }
}

export default fetchWithErrorHandling;
