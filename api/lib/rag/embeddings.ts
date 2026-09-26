/// <reference lib="dom" />
/**
 * Embedding layer for the Epimetheus RAG pipeline.
 *
 * Design contract (see docs/architecture/rag.md and the failure-mode table in
 * HANDOFF notes): this module NEVER throws. Every public function resolves.
 *
 * Provider order:
 *   1. Regolo `/v1/embeddings` (remote, dimension-normalised to EMBEDDING_DIM)
 *   2. Local TF-IDF hashed into EMBEDDING_DIM dimensions (deterministic, offline)
 *
 * The TF-IDF path is a real retrieval signal, not a stub: it builds a
 * document-frequency table across the candidate corpus, weights term frequency
 * by inverse document frequency, hashes each term into a 1024-slot vector and
 * L2-normalises it. Cosine similarity on those vectors behaves like a classic
 * vector-space retrieval score, so the pipeline degrades instead of failing.
 *
 * Remote calls are skipped entirely when `RAG_DISABLE_REMOTE_EMBEDDINGS=1`
 * (used by tests and by operators who want a fully offline deployment).
 */

/** Fixed width of the `user_embeddings.embedding` column (`VECTOR(1024)`). */
export const EMBEDDING_DIM = 1024;

const DEFAULT_BASE_URL = 'https://api.regolo.ai/v1';
const DEFAULT_EMBEDDING_MODEL = 'bge-m3';
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_TOKENS_PER_TEXT = 400;

export type EmbeddingProvider = 'regolo' | 'tfidf';

export interface EmbeddingBatch {
  vectors: number[][];
  provider: EmbeddingProvider;
}

export interface RetrievalVectors {
  /** One vector per input document (order preserved). */
  docs: number[][];
  /** Vector for the query, in the same space as `docs`. */
  query: number[];
  provider: EmbeddingProvider;
}

function resolveEmbeddingsUrl(): string {
  const configured =
    process.env.REGOLO_EMBEDDINGS_URL || process.env.REGOLO_API_ENDPOINT || DEFAULT_BASE_URL;
  const trimmed = configured.replace(/\/+$/, '');
  return trimmed.endsWith('/embeddings') ? trimmed : `${trimmed}/embeddings`;
}

function resolveEmbeddingModel(): string {
  return process.env.RAG_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
}

/** Pad with zeros or truncate so every stored vector matches the column width. */
export function resizeVector(vec: number[], dim: number = EMBEDDING_DIM): number[] {
  if (vec.length === dim) return vec;
  const out = new Array<number>(dim).fill(0);
  for (let i = 0; i < Math.min(vec.length, dim); i++) out[i] = vec[i];
  return out;
}

function l2Normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  if (sum === 0) return vec;
  const norm = Math.sqrt(sum);
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    const x = Number.isFinite(a[i]) ? a[i] : 0;
    const y = Number.isFinite(b[i]) ? b[i] : 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function tokenize(text: string): string[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1)
    .slice(0, MAX_TOKENS_PER_TEXT);
}

/** FNV-1a hash mapped into the embedding dimension space. */
function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % EMBEDDING_DIM;
}

/**
 * Deterministic TF-IDF vectors over the supplied corpus. Always available,
 * needs no network and no API key.
 */
export function tfidfVectors(
  docs: string[],
  query?: string,
): { vectors: number[][]; queryVec: number[] } {
  const docTokens = docs.map(tokenize);
  const total = Math.max(docTokens.length, 1);

  const df = new Map<string, number>();
  for (const tokens of docTokens) {
    for (const term of new Set(tokens)) df.set(term, (df.get(term) ?? 0) + 1);
  }

  const toVector = (tokens: string[]): number[] => {
    const vec = new Array<number>(EMBEDDING_DIM).fill(0);
    if (tokens.length === 0) return vec;
    const counts = new Map<string, number>();
    for (const term of tokens) counts.set(term, (counts.get(term) ?? 0) + 1);
    for (const [term, count] of counts) {
      const idf = Math.log(1 + total / (df.get(term) ?? 1));
      vec[hashToken(term)] += (count / tokens.length) * idf;
    }
    return l2Normalize(vec);
  };

  return {
    vectors: docTokens.map(toVector),
    queryVec: query === undefined ? [] : toVector(tokenize(query)),
  };
}

async function embedViaRegolo(texts: string[]): Promise<number[][]> {
  if (process.env.RAG_DISABLE_REMOTE_EMBEDDINGS === '1') {
    throw new Error('remote embeddings disabled via RAG_DISABLE_REMOTE_EMBEDDINGS');
  }
  const apiKey = process.env.REGOLO_API_KEY;
  if (!apiKey) throw new Error('REGOLO_API_KEY not configured');

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  if (controller) timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(resolveEmbeddingsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: resolveEmbeddingModel(), input: texts }),
      signal: controller ? controller.signal : undefined,
    });

    if (!response.ok) {
      throw new Error(`embeddings request failed with HTTP ${response.status}`);
    }

    const payload: any = await response.json();
    const data: any[] | null = Array.isArray(payload?.data) ? payload.data : null;
    if (!data || data.length !== texts.length) {
      throw new Error('unexpected embeddings payload shape');
    }

    return data.map((entry: any) => {
      const raw = Array.isArray(entry?.embedding)
        ? entry.embedding
        : Array.isArray(entry)
          ? entry
          : null;
      if (!raw || raw.length === 0) throw new Error('missing embedding vector in payload');
      const nums = raw.map((n: any) => (typeof n === 'number' && Number.isFinite(n) ? n : 0));
      return resizeVector(l2Normalize(nums));
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Embed a batch of documents. Soft-fails to TF-IDF; never throws.
 */
export async function embedTexts(texts: string[]): Promise<EmbeddingBatch> {
  if (!Array.isArray(texts) || texts.length === 0) {
    return { vectors: [], provider: 'tfidf' };
  }
  try {
    return { vectors: await embedViaRegolo(texts), provider: 'regolo' };
  } catch (err) {
    console.warn(
      '[rag] remote embeddings unavailable, using TF-IDF fallback:',
      err instanceof Error ? err.message : String(err),
    );
    return { vectors: tfidfVectors(texts).vectors, provider: 'tfidf' };
  }
}

/**
 * Embed a corpus plus its query in a single shared space. When the remote
 * provider is unavailable both the documents and the query are projected into
 * the same TF-IDF space so cosine similarity stays meaningful.
 */
export async function embedForRetrieval(docs: string[], query: string): Promise<RetrievalVectors> {
  if (!Array.isArray(docs) || docs.length === 0) {
    return { docs: [], query: [], provider: 'tfidf' };
  }
  try {
    const vectors = await embedViaRegolo([...docs, query]);
    return {
      docs: vectors.slice(0, docs.length),
      query: vectors[vectors.length - 1] ?? [],
      provider: 'regolo',
    };
  } catch {
    const local = tfidfVectors(docs, query);
    return { docs: local.vectors, query: local.queryVec, provider: 'tfidf' };
  }
}

/** Serialise a vector into pgvector's text representation. */
export function serializeVector(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

/**
 * Parse a pgvector value. PostgREST returns `VECTOR` columns either as a JSON
 * array (when the client requests JSON) or as the `[1,2,3]` text form.
 */
export function parseVector(raw: unknown): number[] | null {
  if (Array.isArray(raw)) {
    const nums = raw.map((n) => (typeof n === 'number' && Number.isFinite(n) ? n : null));
    return nums.some((n) => n === null) ? null : (nums as number[]);
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  const parts = trimmed.slice(1, -1).split(',');
  const out: number[] = [];
  for (const part of parts) {
    const n = Number.parseFloat(part);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out.length > 0 ? out : null;
}

/** True when remote embeddings are configured and not explicitly disabled. */
export function remoteEmbeddingsConfigured(): boolean {
  return (
    process.env.RAG_DISABLE_REMOTE_EMBEDDINGS !== '1' && !!process.env.REGOLO_API_KEY
  );
}
