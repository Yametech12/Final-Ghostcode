import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  retrieveChunks,
  timeDecay,
  TIME_DECAY_FLOOR,
  TIME_DECAY_HALF_LIFE_DAYS,
} from './retriever';

/**
 * The retriever is exercised against the real TF-IDF fallback path (no network,
 * no API key required) by disabling remote embeddings for these tests.
 */
beforeEach(() => {
  vi.stubEnv('RAG_DISABLE_REMOTE_EMBEDDINGS', '1');
  vi.stubEnv('REGOLO_API_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

interface Row {
  source_table: string;
  source_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: string;
  created_at: string;
}

/**
 * Minimal PostgREST-shaped double: from().select().eq().limit() resolves with
 * the supplied rows. `mode` lets a test force a read error.
 */
function makeSupabase(rows: Row[], mode: 'ok' | 'error' = 'ok') {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: async () => {
            if (mode === 'error') return { data: null, error: { message: 'db down' } };
            return { data: rows, error: null };
          },
        }),
      }),
    }),
  } as any;
}

function row(overrides: Partial<Row>): Row {
  return {
    source_table: 'field_reports',
    source_id: '11111111-1111-1111-1111-111111111111',
    chunk_index: 0,
    chunk_text: '',
    embedding: '[0.1,0.2,0.3]',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('timeDecay', () => {
  it('returns 1 for a fresh chunk and halves at the half-life', () => {
    expect(timeDecay(0)).toBe(1);
    expect(timeDecay(TIME_DECAY_HALF_LIFE_DAYS)).toBeCloseTo(0.5, 5);
  });

  it('never decays below the floor', () => {
    expect(timeDecay(10_000)).toBe(TIME_DECAY_FLOOR);
  });
});

describe('retrieveChunks', () => {
  it('returns [] without querying when the query is empty', async () => {
    const supabase = makeSupabase([row({ chunk_text: 'anything' })]);
    expect(await retrieveChunks('user-1', '   ', supabase)).toEqual([]);
    expect(await retrieveChunks('', 'hello', supabase)).toEqual([]);
  });

  it('returns [] when the user has no embeddings', async () => {
    expect(await retrieveChunks('user-1', 'coffee date', makeSupabase([]))).toEqual([]);
  });

  it('returns [] instead of throwing when the read fails', async () => {
    const supabase = makeSupabase([], 'error');
    await expect(retrieveChunks('user-1', 'coffee date', supabase)).resolves.toEqual([]);
  });

  it('orders the top-K by descending score', async () => {
    const supabase = makeSupabase([
      row({
        source_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        chunk_text: 'Budget spreadsheet quarterly report numbers',
      }),
      row({
        source_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        chunk_text: 'She keeps texting but will not commit to plans',
      }),
      row({
        source_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        chunk_text: 'I want to ask her out but I am nervous',
      }),
    ]);

    const result = await retrieveChunks('user-1', 'she keeps texting but will not commit', supabase);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].sourceId).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    expect(result[0].score).toBeGreaterThan(result[result.length - 1].score);
    // Scores are sorted descending.
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it('caps the number of chunks returned at k', async () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row({
        source_id: `${String(i).repeat(8)}-1111-1111-1111-111111111111`,
        chunk_text: `field report about commitment signal number ${i}`,
      }),
    );
    const result = await retrieveChunks('user-1', 'commitment signal', makeSupabase(rows), 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('keeps at most 2 chunks per source row', async () => {
    const rows = [
      row({ chunk_index: 0, chunk_text: 'commitment signal one' }),
      row({ chunk_index: 1, chunk_text: 'commitment signal two' }),
      row({ chunk_index: 2, chunk_text: 'commitment signal three' }),
    ];
    const result = await retrieveChunks('user-1', 'commitment signal', makeSupabase(rows), 5);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('skips rows whose embedding cannot be parsed', async () => {
    const rows = [
      row({ source_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', embedding: 'not-a-vector', chunk_text: 'commitment signal' }),
      row({
        source_id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        embedding: '[1,2,3]',
        chunk_text: 'commitment signal',
      }),
    ];
    const result = await retrieveChunks('user-1', 'commitment signal', makeSupabase(rows));
    expect(result.map((r) => r.sourceId)).toEqual(['eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee']);
  });

  it('applies time decay so a fresher chunk outranks an identical older one', async () => {
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const rows = [
      row({
        source_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        chunk_text: 'commitment signal identical text',
        created_at: old,
      }),
      row({
        source_id: '99999999-9999-9999-9999-999999999999',
        chunk_text: 'commitment signal identical text',
        created_at: new Date().toISOString(),
      }),
    ];
    const result = await retrieveChunks('user-1', 'commitment signal', makeSupabase(rows));
    expect(result[0].sourceId).toBe('99999999-9999-9999-9999-999999999999');
    expect(result[0].ageDays).toBeLessThan(result[1].ageDays);
  });
});
