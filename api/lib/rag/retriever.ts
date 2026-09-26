/**
 * RAG retriever — cosine similarity top-K over a user's own embeddings, with
 * time-decay weighting so recent calibration/report data outranks stale data.
 *
 * Failure contract: NEVER throws. Any error (DB down, malformed vector,
 * embedding provider outage) degrades to `[]`, which routes the caller to the
 * no-context prompt path.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { cosineSimilarity, embedForRetrieval, parseVector } from './embeddings';

export interface RetrievedChunk {
  sourceTable: string;
  sourceId: string;
  chunkIndex: number;
  text: string;
  /** similarity × time decay */
  score: number;
  /** raw cosine similarity, before decay */
  similarity: number;
  ageDays: number;
}

export const RETRIEVAL_TOP_K = 5;
export const TIME_DECAY_HALF_LIFE_DAYS = 45;
export const TIME_DECAY_FLOOR = 0.35;
const MAX_SCAN_ROWS = 1000;
const MAX_CHUNKS_PER_SOURCE = 2;

interface IndexedRow {
  sourceTable: string;
  sourceId: string;
  chunkIndex: number;
  text: string;
  vector: number[];
  createdAt: string | null;
}

/** Half-life decay with a floor so old-but-relevant data is never fully muted. */
export function timeDecay(ageDays: number): number {
  const safeAge = Number.isFinite(ageDays) && ageDays > 0 ? ageDays : 0;
  return Math.max(TIME_DECAY_FLOOR, Math.pow(0.5, safeAge / TIME_DECAY_HALF_LIFE_DAYS));
}

function ageInDays(createdAt: string | null): number {
  if (!createdAt) return 0;
  const ts = Date.parse(createdAt);
  if (!Number.isFinite(ts)) return 0;
  const days = (Date.now() - ts) / 86_400_000;
  return days > 0 ? days : 0;
}

/**
 * Retrieve the top-K most relevant chunks for a query.
 */
export async function retrieveChunks(
  userId: string,
  query: string,
  supabase: SupabaseClient,
  k: number = RETRIEVAL_TOP_K,
): Promise<RetrievedChunk[]> {
  if (!userId || typeof query !== 'string' || query.trim().length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('user_embeddings')
      .select('source_table, source_id, chunk_index, chunk_text, embedding, created_at')
      .eq('user_id', userId)
      .limit(MAX_SCAN_ROWS);

    if (error || !Array.isArray(data) || data.length === 0) return [];

    const rows: IndexedRow[] = [];
    for (const raw of data as Array<Record<string, any>>) {
      const vector = parseVector(raw?.embedding);
      const text = typeof raw?.chunk_text === 'string' ? raw.chunk_text : '';
      if (!vector || text.length === 0) continue;
      if (typeof raw?.source_id !== 'string') continue;
      rows.push({
        sourceTable: typeof raw.source_table === 'string' ? raw.source_table : 'unknown',
        sourceId: raw.source_id,
        chunkIndex: typeof raw.chunk_index === 'number' ? raw.chunk_index : 0,
        text,
        vector,
        createdAt: typeof raw.created_at === 'string' ? raw.created_at : null,
      });
    }
    if (rows.length === 0) return [];

    const { docs, query: queryVector, provider } = await embedForRetrieval(
      rows.map((r) => r.text),
      query,
    );
    if (!queryVector || queryVector.length === 0) return [];

    const scored: RetrievedChunk[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // In the TF-IDF fallback the stored vectors live in a different space
      // (they may have been written by the remote provider), so score against
      // the locally recomputed document vectors instead.
      const docVector = provider === 'tfidf' ? docs[i] ?? [] : row.vector;
      const similarity = cosineSimilarity(queryVector, docVector);
      if (!(similarity > 0)) continue;
      const ageDays = ageInDays(row.createdAt);
      scored.push({
        sourceTable: row.sourceTable,
        sourceId: row.sourceId,
        chunkIndex: row.chunkIndex,
        text: row.text,
        similarity,
        ageDays,
        score: similarity * timeDecay(ageDays),
      });
    }

    scored.sort((a, b) => b.score - a.score);

    // Diversity guard: keep at most MAX_CHUNKS_PER_SOURCE chunks per source row
    // so one long field report cannot fill the whole context window.
    const perSource = new Map<string, number>();
    const selected: RetrievedChunk[] = [];
    for (const chunk of scored) {
      const key = `${chunk.sourceTable}:${chunk.sourceId}`;
      const used = perSource.get(key) ?? 0;
      if (used >= MAX_CHUNKS_PER_SOURCE) continue;
      perSource.set(key, used + 1);
      selected.push(chunk);
      if (selected.length >= Math.max(1, k)) break;
    }

    return selected;
  } catch (err) {
    console.warn(
      '[rag] retrieval failed, continuing without context:',
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}
