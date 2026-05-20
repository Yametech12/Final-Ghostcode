/// <reference lib="dom" />
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Verify a Supabase JWT from the Authorization header.
 * Returns the authenticated user on success, or null if the header is missing/invalid.
 *
 * Server routes that handle user data MUST derive userId from this function,
 * never trust a client-supplied userId in the body or query string.
 */
export async function getAuthenticatedUser(
  authHeader: string | undefined,
  supabase: SupabaseClient
): Promise<User | null> {
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth] No Authorization header or missing Bearer prefix.');
    }
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[auth] supabase.auth.getUser failed:', error?.message || 'no user returned');
      }
      return null;
    }
    return data.user;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[auth] Exception in getAuthenticatedUser:', err);
    }
    return null;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(uuid: string | undefined | null): boolean {
  return typeof uuid === 'string' && UUID_REGEX.test(uuid);
}
