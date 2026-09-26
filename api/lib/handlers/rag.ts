/**
 * RAG domain handlers.
 *
 * Routes (registered in api/_index.ts):
 *   POST /api/rag/reindex — authenticated, force re-index of the caller's data
 *   POST /api/rag/toggle  — authenticated, opt in/out of advisor RAG
 *   GET  /api/rag/status  — authenticated, index + preference status for the UI
 *
 * Every handler is soft-fail by design: an embedding outage, a missing
 * migration or a DB error must never break the advisor. Handlers therefore
 * return HTTP 200 with `{ ok: false, reason }` instead of 5xx, except for
 * authentication (401) and malformed input (400).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedRequest, NormalizedResponse } from '../handlers';
import { indexUser } from '../rag/indexer';
import { reindexUser } from '../rag/scheduler';

export const RAG_PREFERENCE_KEY = 'useRagForAdvisor';

/** Preferences default to RAG ON; users opt out explicitly. */
export function isRagPreferenceEnabled(preferences: unknown): boolean {
  if (!preferences || typeof preferences !== 'object') return true;
  const value = (preferences as Record<string, unknown>)[RAG_PREFERENCE_KEY];
  return value === undefined ? true : value !== false;
}

export async function readPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; preferences: Record<string, any> }> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .maybeSingle();
    if (error) return { ok: false, preferences: {} };
    const row = (data ?? null) as { preferences?: unknown } | null;
    const prefs = row?.preferences;
    return {
      ok: true,
      preferences: prefs && typeof prefs === 'object' ? (prefs as Record<string, any>) : {},
    };
  } catch {
    return { ok: false, preferences: {} };
  }
}

/**
 * Server-side source of truth for the advisor: is RAG enabled for this user?
 * Soft-fails to `true` (the product default) so an unreadable preference row
 * does not silently disable the feature.
 */
export async function isRagEnabledForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { ok, preferences } = await readPreferences(supabase, userId);
  if (!ok) return true;
  return isRagPreferenceEnabled(preferences);
}

function unauthorized(): NormalizedResponse {
  return { status: 401, body: { error: 'Authentication required', code: 'UNAUTHORIZED' } };
}

/**
 * POST /api/rag/reindex — body: { force?: boolean }
 */
export async function handleRagReindex(
  req: NormalizedRequest,
  supabase: SupabaseClient,
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const userId = req.user.id;
  const force = req.body?.force !== false; // explicit user action → force by default

  const result = await reindexUser(userId, supabase, { reason: 'api-request', force });

  return {
    status: 200,
    body: {
      ok: result.ok,
      chunks: result.chunks,
      provider: result.provider,
      status: result.status,
      skipped: result.skipped ?? false,
      ...(result.ok ? {} : { reason: result.error ?? 'INDEX_FAILED' }),
    },
  };
}

/**
 * POST /api/rag/toggle — body: { enabled: boolean }
 */
export async function handleRagToggle(
  req: NormalizedRequest,
  supabase: SupabaseClient,
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const userId = req.user.id;

  const enabled = req.body?.enabled;
  if (typeof enabled !== 'boolean') {
    return { status: 400, body: { error: 'enabled must be a boolean', code: 'BAD_REQUEST' } };
  }

  const { ok, preferences } = await readPreferences(supabase, userId);
  if (!ok) {
    // Pre-migration database (no `users.preferences` column) or a read error.
    // Report honestly but keep the endpoint non-breaking.
    return {
      status: 200,
      body: {
        ok: false,
        reason: 'PREFERENCES_UNAVAILABLE',
        useRagForAdvisor: enabled,
      },
    };
  }

  const merged = { ...preferences, [RAG_PREFERENCE_KEY]: enabled };

  try {
    const { error } = await supabase.from('users').update({ preferences: merged }).eq('id', userId);
    if (error) throw new Error(error.message);
    return { status: 200, body: { ok: true, useRagForAdvisor: enabled } };
  } catch (err) {
    console.error('[rag] preference write failed', {
      userId,
      message: err instanceof Error ? err.message : String(err),
    });
    return {
      status: 200,
      body: { ok: false, reason: 'PREFERENCES_WRITE_FAILED', useRagForAdvisor: enabled },
    };
  }
}

/**
 * GET /api/rag/status
 */
export async function handleRagStatus(
  req: NormalizedRequest,
  supabase: SupabaseClient,
): Promise<NormalizedResponse> {
  if (!req.user) return unauthorized();
  const userId = req.user.id;

  const { ok, preferences } = await readPreferences(supabase, userId);
  const useRagForAdvisor = isRagPreferenceEnabled(preferences);

  let embeddingStatus: string | null = null;
  let lastIndexedAt: string | null = null;
  let chunkCount = 0;

  try {
    const { data } = await supabase
      .from('users')
      .select('embedding_status, last_indexed_at')
      .eq('id', userId)
      .maybeSingle();
    const row = (data ?? null) as { embedding_status?: string | null; last_indexed_at?: string | null } | null;
    embeddingStatus = row?.embedding_status ?? null;
    lastIndexedAt = row?.last_indexed_at ?? null;
  } catch {
    /* status is advisory only */
  }

  try {
    const { count } = await supabase
      .from('user_embeddings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    chunkCount = typeof count === 'number' ? count : 0;
  } catch {
    /* advisory only */
  }

  return {
    status: 200,
    body: {
      ok: true,
      configured: ok,
      useRagForAdvisor,
      embeddingStatus,
      lastIndexedAt,
      chunkCount,
    },
  };
}

/** Exported for tests: index a single user through the same path the route uses. */
export { indexUser };
