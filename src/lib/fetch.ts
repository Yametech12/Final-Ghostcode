/// <reference lib="dom" />
/**
 * Reusable fetch utility with proper JSON error handling and automatic
 * Authorization header injection from the active Supabase session.
 *
 * All `/api/*` calls go through `apiFetch` so they include the bearer JWT;
 * the server now requires authentication on AI/advisor/upload endpoints.
 */

import { supabase } from './supabase';

interface FetchOptions extends RequestInit {
  timeout?: number;
}

/**
 * Get the current Supabase access token (JWT) for authenticating server requests.
 * Uses getSession() which auto-refreshes expired tokens when possible.
 * Falls back to null if no active session or refresh fails.
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
        console.warn('[apiFetch] Token refresh failed:', refreshError?.message);
        // Still try the old token — server will reject if truly expired
        return access_token;
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
  if (import.meta.env.DEV && !token) {
    console.warn('[apiFetch] Sending request WITHOUT auth token to:', typeof input === 'string' ? input : (input as Request).url);
  }
  return fetch(input, { ...init, headers });
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
      let errorData: any;
      try {
        errorData = await response.json();
        throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
      } catch (_jsonError) {
        const text = await responseClone.text();
        console.error(`[Fetch Error] ${response.status} ${url}:`, text);
        throw new Error(`Request failed with status ${response.status}`);
      }
    }

    try {
      return (await response.json()) as T;
    } catch (_jsonError) {
      const text = await responseClone.text();
      console.error(`[JSON Parse Error] ${url}:`, text);
      throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }

    throw error;
  }
}

export default fetchWithErrorHandling;
