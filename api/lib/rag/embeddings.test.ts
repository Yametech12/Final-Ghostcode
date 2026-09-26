import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EMBEDDING_DIM,
  cosineSimilarity,
  embedTexts,
  embedForRetrieval,
  parseVector,
  serializeVector,
  resizeVector,
  tokenize,
} from './embeddings';

beforeEach(() => {
  vi.stubEnv('RAG_DISABLE_REMOTE_EMBEDDINGS', '1');
  vi.stubEnv('REGOLO_API_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('vector helpers', () => {
  it('pads and truncates to the column width', () => {
    expect(resizeVector([1, 2, 3]).length).toBe(EMBEDDING_DIM);
    expect(resizeVector(new Array(EMBEDDING_DIM + 10).fill(1)).length).toBe(EMBEDDING_DIM);
  });

  it('round-trips through pgvector text form', () => {
    const vec = [0.5, -0.25, 0];
    expect(parseVector(serializeVector(vec))).toEqual(vec);
  });

  it('parses an array form and rejects garbage', () => {
    expect(parseVector([1, 2])).toEqual([1, 2]);
    expect(parseVector('not a vector')).toBeNull();
    expect(parseVector('[1,abc]')).toBeNull();
    expect(parseVector(null)).toBeNull();
  });

  it('scores identical vectors 1 and orthogonal vectors 0', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 6);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
  });
});

describe('tokenize', () => {
  it('lowercases, splits on non-alphanumerics and drops single characters', () => {
    expect(tokenize('She keeps texting, but will NOT commit!')).toEqual([
      'she',
      'keeps',
      'texting',
      'but',
      'will',
      'not',
      'commit',
    ]);
  });

  it('handles non-string input', () => {
    expect(tokenize(undefined as unknown as string)).toEqual([]);
  });
});

describe('embedTexts (offline fallback)', () => {
  it('falls back to TF-IDF and never throws when no key is configured', async () => {
    const { vectors, provider } = await embedTexts(['commitment signal', 'budget spreadsheet']);
    expect(provider).toBe('tfidf');
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(EMBEDDING_DIM);
  });

  it('returns an empty batch for empty input', async () => {
    const result = await embedTexts([]);
    expect(result.vectors).toEqual([]);
  });
});

describe('embedForRetrieval (offline fallback)', () => {
  it('projects documents and query into one space so similarity ranks the match', async () => {
    const docs = ['she keeps texting but will not commit', 'quarterly budget spreadsheet'];
    const { docs: vectors, query, provider } = await embedForRetrieval(
      docs,
      'she keeps texting and will not commit',
    );

    expect(provider).toBe('tfidf');
    expect(vectors).toHaveLength(2);
    expect(query).toHaveLength(EMBEDDING_DIM);

    const relevant = cosineSimilarity(query, vectors[0]);
    const irrelevant = cosineSimilarity(query, vectors[1]);
    expect(relevant).toBeGreaterThan(irrelevant);
    expect(relevant).toBeGreaterThan(0);
  });

  it('returns empty vectors when there is no corpus', async () => {
    const result = await embedForRetrieval([], 'anything');
    expect(result).toEqual({ docs: [], query: [], provider: 'tfidf' });
  });
});
