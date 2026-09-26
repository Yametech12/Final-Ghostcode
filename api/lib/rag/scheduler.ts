/**
 * RAG indexing scheduler.
 *
 * Two entry points:
 *   - `reindexUser(userId)`   — idempotent, de-duplicated per user in-process,
 *                               skippable when the index is still fresh.
 *   - `reindexStaleUsers()`   — the cron sweep: finds users whose index is
 *                               missing, failed or older than the freshness
 *                               window and re-indexes them one by one.
 *
 * Idempotency has two layers:
 *   1. `indexUser` uses an upsert on the embeddings unique constraint, so the
 *      same source rows converge to the same rows.
 *   2. `reindexUser` keeps an in-flight map, so N concurrent triggers (chat
 *      turns, oracle completion, cron) collapse into a single indexing run.
 *
 * Never throws: failures are returned as `{ ok: false }` results.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { indexUser, type IndexResult } from './indexer';

/** How old an index may get before a background trigger will refresh it. */
export const RAG_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const inFlight = new Map<string, Promise<IndexResult>>();

/** Test-only: clear the in-flight de-duplication map. */
export function __resetRagSchedulerForTests(): void {
  inFlight.clear();
}

export interface ReindexOptions {
  reason?: string;
  /** Bypass the freshness check (cron sweep and explicit user requests). */
  force?: boolean;
}

function emptyResult(userId: string, status: 'ready' | 'failed', error?: string): IndexResult {
  return { ok: status === 'ready', userId, chunks: 0, provider: 'none', status, error };
}

/**
 * Freshness check. Returns `true` when the user should be re-indexed:
 * missing timestamp, unparseable timestamp, a previous failure, or an index
 * older than RAG_STALE_AFTER_MS.
 */
export async function shouldReindex(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('last_indexed_at, embedding_status')
      .eq('id', userId)
      .maybeSingle();

    if (error) return true;

    const row = (data ?? null) as { last_indexed_at?: string | null; embedding_status?: string | null } | null;
    if (row?.embedding_status === 'failed') return true;

    const last = row?.last_indexed_at ?? null;
    if (!last) return true;

    const ts = Date.parse(last);
    if (!Number.isFinite(ts)) return true;

    return Date.now() - ts >= RAG_STALE_AFTER_MS;
  } catch {
    return true;
  }
}

export async function reindexUser(
  userId: string,
  supabase: SupabaseClient,
  options: ReindexOptions = {},
): Promise<IndexResult> {
  const { reason = 'manual', force = false } = options;

  if (!userId) return emptyResult('', 'failed', 'missing userId');

  const existing = inFlight.get(userId);
  if (existing) return existing;

  const run = (async (): Promise<IndexResult> => {
    if (!force) {
      const stale = await shouldReindex(supabase, userId);
      if (!stale) {
        return { ok: true, userId, chunks: 0, provider: 'none', status: 'ready', skipped: true };
      }
    }
    void reason; // recorded in the caller's log line, not persisted
    return indexUser(userId, supabase);
  })();

  inFlight.set(userId, run);
  try {
    return await run;
  } finally {
    inFlight.delete(userId);
  }
}

export interface StaleSweepOptions {
  maxAgeDays?: number;
  limit?: number;
}

export interface StaleSweepEntry {
  userId: string;
  ok: boolean;
  skipped?: boolean;
}

/**
 * Cron entry point: re-index users whose index is missing, failed or stale.
 */
export async function reindexStaleUsers(
  supabase: SupabaseClient,
  options: StaleSweepOptions = {},
): Promise<StaleSweepEntry[]> {
  const { maxAgeDays = 7, limit = 25 } = options;
  const results: StaleSweepEntry[] = [];

  try {
    const cutoff = new Date(Date.now() - maxAgeDays * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from('users')
      .select('id, last_indexed_at, embedding_status')
      .or(`last_indexed_at.is.null,last_indexed_at.lt.${cutoff}`)
      .limit(limit);

    if (error || !Array.isArray(data)) return results;

    for (const row of data as Array<{ id?: string }>) {
      if (typeof row.id !== 'string') continue;
      const result = await reindexUser(row.id, supabase, {
        reason: 'cron-stale',
        force: true,
      });
      results.push({ userId: row.id, ok: result.ok, skipped: result.skipped });
    }
  } catch (err) {
    console.warn(
      '[rag] reindexStaleUsers sweep failed:',
      err instanceof Error ? err.message : String(err),
    );
  }

  return results;
}
