/**
 * RAG indexer — turns a user's own product data into embedding rows.
 *
 * Sources (all scoped to `user_id`, all read through the service-role client):
 *   - `calibrations`      last 20  (personality profile + trait vector)
 *   - `field_reports`     last 30  (scenario / action / result history)
 *   - `favorites`         all      (saved types, guides, calibrations)
 *
 * Idempotency: rows are written with `upsert` on the
 * `(user_id, source_table, source_id, chunk_index)` unique constraint, so
 * re-running for the same user converges to the same rows instead of
 * duplicating them. Nothing is deleted before a successful write, so a failed
 * re-run leaves the previous index intact.
 *
 * Failure contract: `indexUser` never throws. On any error it logs, stamps
 * `users.embedding_status='failed'` and returns `{ ok: false }` so callers can
 * keep serving the user without RAG.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { EMBEDDING_DIM, embedTexts, serializeVector, type EmbeddingProvider } from './embeddings';

export type RagSourceTable = 'calibrations' | 'field_reports' | 'favorites';

export interface RagSourceChunk {
  sourceTable: RagSourceTable;
  sourceId: string;
  chunkIndex: number;
  text: string;
  sourceTimestamp: string | null;
}

export interface IndexResult {
  ok: boolean;
  userId: string;
  chunks: number;
  provider: EmbeddingProvider | 'none';
  status: 'ready' | 'failed';
  skipped?: boolean;
  error?: string;
}

export const RAG_LIMITS = {
  calibrations: 20,
  fieldReports: 30,
  favorites: 200,
} as const;

export const MAX_CHUNK_CHARS = 1200;
const INSERT_BATCH_SIZE = 50;

/**
 * Split long source text into stable, index-aligned chunks. Splitting happens
 * on whitespace so `chunk_index` is deterministic for identical input.
 */
export function chunkText(text: string, max: number = MAX_CHUNK_CHARS): string[] {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (clean.length === 0) return [];
  if (clean.length <= max) return [clean];

  const words = clean.split(/\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
      continue;
    }
    if (current.length + 1 + word.length > max) {
      chunks.push(current);
      current = word;
    } else {
      current += ` ${word}`;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function pushChunks(
  out: RagSourceChunk[],
  sourceTable: RagSourceTable,
  sourceId: string,
  sourceTimestamp: string | null,
  text: string,
): void {
  const pieces = chunkText(text);
  pieces.forEach((piece, index) => {
    out.push({ sourceTable, sourceId, chunkIndex: index, text: piece, sourceTimestamp });
  });
}

function calibrationText(row: Record<string, any>): string {
  const typeId = str(row.type_id) || 'Unknown';
  const traits = (row.traits ?? {}) as Record<string, unknown>;
  const traitLine = [
    `time=${Math.round(num(traits.timeOrientation, 50))}`,
    `emotional=${Math.round(num(traits.emotionalStyle, 50))}`,
    `relationship=${Math.round(num(traits.relationshipFocus, 50))}`,
  ].join(' ');
  return `Personality calibration (${typeId}). Trait scores (0-100): ${traitLine}.`;
}

function reportText(row: Record<string, any>): string {
  const parts = [
    `Field report (${str(row.type) || 'general'})`,
    str(row.title) ? `Title: ${str(row.title)}` : '',
    str(row.scenario) ? `Scenario: ${str(row.scenario)}` : '',
    str(row.action) ? `Action: ${str(row.action)}` : '',
    str(row.result) ? `Result: ${str(row.result)}` : '',
  ].filter((p) => p.length > 0);
  return parts.join('. ');
}

function favoriteText(row: Record<string, any>): string {
  const kind = str(row.content_type) || 'item';
  const category = str(row.category) || 'General';
  const title = str(row.title) || str(row.content_id);
  return `Saved ${kind} (${category}): ${title}.`;
}

/**
 * Read the user's indexable rows and flatten them into chunks.
 * Individual query errors are tolerated (the source simply contributes nothing).
 */
export async function collectChunks(
  supabase: SupabaseClient,
  userId: string,
): Promise<RagSourceChunk[]> {
  const [calibrations, reports, favorites] = await Promise.all([
    supabase
      .from('calibrations')
      .select('id, type_id, traits, timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(RAG_LIMITS.calibrations),
    supabase
      .from('field_reports')
      .select('id, title, type, scenario, action, result, timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(RAG_LIMITS.fieldReports),
    supabase
      .from('favorites')
      .select('id, content_id, content_type, category, title, timestamp')
      .eq('user_id', userId)
      .limit(RAG_LIMITS.favorites),
  ]);

  const out: RagSourceChunk[] = [];

  for (const row of (calibrations.data ?? []) as Array<Record<string, any>>) {
    if (typeof row.id !== 'string') continue;
    pushChunks(out, 'calibrations', row.id, row.timestamp ?? null, calibrationText(row));
  }
  for (const row of (reports.data ?? []) as Array<Record<string, any>>) {
    if (typeof row.id !== 'string') continue;
    pushChunks(out, 'field_reports', row.id, row.timestamp ?? null, reportText(row));
  }
  for (const row of (favorites.data ?? []) as Array<Record<string, any>>) {
    if (typeof row.id !== 'string') continue;
    pushChunks(out, 'favorites', row.id, row.timestamp ?? null, favoriteText(row));
  }

  return out;
}

async function markStatus(
  supabase: SupabaseClient,
  userId: string,
  status: 'ready' | 'failed',
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ embedding_status: status, last_indexed_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

/**
 * Index (or re-index) one user. Idempotent and non-throwing.
 */
export async function indexUser(
  userId: string,
  supabase: SupabaseClient,
): Promise<IndexResult> {
  if (!userId) {
    return { ok: false, userId: '', chunks: 0, provider: 'none', status: 'failed', error: 'missing userId' };
  }

  try {
    const chunks = await collectChunks(supabase, userId);

    if (chunks.length === 0) {
      await markStatus(supabase, userId, 'ready');
      return { ok: true, userId, chunks: 0, provider: 'none', status: 'ready' };
    }

    const { vectors, provider } = await embedTexts(chunks.map((c) => c.text));

    const rows = chunks.map((chunk, index) => ({
      user_id: userId,
      source_table: chunk.sourceTable,
      source_id: chunk.sourceId,
      chunk_index: chunk.chunkIndex,
      chunk_text: chunk.text,
      embedding: serializeVector(
        vectors[index] ?? new Array<number>(EMBEDDING_DIM).fill(0),
      ),
      created_at: chunk.sourceTimestamp ?? new Date().toISOString(),
    }));

    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
      const { error } = await supabase
        .from('user_embeddings')
        .upsert(rows.slice(i, i + INSERT_BATCH_SIZE), {
          onConflict: 'user_id,source_table,source_id,chunk_index',
        });
      if (error) throw new Error(error.message);
    }

    await markStatus(supabase, userId, 'ready');
    return { ok: true, userId, chunks: rows.length, provider, status: 'ready' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[rag] indexUser failed', { userId, message });
    try {
      await markStatus(supabase, userId, 'failed');
    } catch {
      /* status stamping is best-effort */
    }
    return { ok: false, userId, chunks: 0, provider: 'none', status: 'failed', error: message };
  }
}
