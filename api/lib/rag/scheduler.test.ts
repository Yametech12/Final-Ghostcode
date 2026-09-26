import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./indexer', () => ({
  indexUser: vi.fn(async (userId: string) => ({
    ok: true,
    userId,
    chunks: 3,
    provider: 'tfidf',
    status: 'ready',
  })),
}));

import { indexUser } from './indexer';
import {
  reindexUser,
  reindexStaleUsers,
  shouldReindex,
  __resetRagSchedulerForTests,
  RAG_STALE_AFTER_MS,
} from './scheduler';

const indexUserMock = indexUser as unknown as ReturnType<typeof vi.fn>;

/** users row lookup: from().select().eq().maybeSingle() */
function makeSupabase(options: {
  lastIndexedAt?: string | null;
  embeddingStatus?: string | null;
  userRows?: Array<{ id: string }>;
  failRead?: boolean;
} = {}) {
  const {
    lastIndexedAt = null,
    embeddingStatus = null,
    userRows = [],
    failRead = false,
  } = options;

  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            failRead
              ? { data: null, error: { message: 'db down' } }
              : { data: { last_indexed_at: lastIndexedAt, embedding_status: embeddingStatus }, error: null },
          limit: async () => ({ data: userRows, error: null }),
        }),
        or: () => ({
          limit: async () => ({ data: userRows, error: null }),
        }),
      }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  } as any;
}

beforeEach(() => {
  __resetRagSchedulerForTests();
  indexUserMock.mockClear();
});

describe('shouldReindex', () => {
  it('is true when the user has never been indexed', async () => {
    expect(await shouldReindex(makeSupabase(), 'user-1')).toBe(true);
  });

  it('is true after a previous failure', async () => {
    const supabase = makeSupabase({
      lastIndexedAt: new Date().toISOString(),
      embeddingStatus: 'failed',
    });
    expect(await shouldReindex(supabase, 'user-1')).toBe(true);
  });

  it('is false while the index is fresher than the stale window', async () => {
    const supabase = makeSupabase({
      lastIndexedAt: new Date().toISOString(),
      embeddingStatus: 'ready',
    });
    expect(await shouldReindex(supabase, 'user-1')).toBe(false);
  });

  it('is true once the index exceeds the stale window', async () => {
    const supabase = makeSupabase({
      lastIndexedAt: new Date(Date.now() - RAG_STALE_AFTER_MS - 1000).toISOString(),
      embeddingStatus: 'ready',
    });
    expect(await shouldReindex(supabase, 'user-1')).toBe(true);
  });

  it('fails safe (reindex) when the lookup errors', async () => {
    expect(await shouldReindex(makeSupabase({ failRead: true }), 'user-1')).toBe(true);
  });
});

describe('reindexUser', () => {
  it('skips a fresh index without forcing', async () => {
    const supabase = makeSupabase({
      lastIndexedAt: new Date().toISOString(),
      embeddingStatus: 'ready',
    });
    const result = await reindexUser('user-1', supabase);
    expect(result.skipped).toBe(true);
    expect(indexUserMock).not.toHaveBeenCalled();
  });

  it('indexes when forced even if the index is fresh', async () => {
    const supabase = makeSupabase({
      lastIndexedAt: new Date().toISOString(),
      embeddingStatus: 'ready',
    });
    const result = await reindexUser('user-1', supabase, { force: true });
    expect(result.ok).toBe(true);
    expect(indexUserMock).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: repeated forced runs converge and never duplicate work', async () => {
    const supabase = makeSupabase();

    const first = await reindexUser('user-1', supabase, { force: true });
    const second = await reindexUser('user-1', supabase, { force: true });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.chunks).toBe(second.chunks);
    expect(first.status).toBe('ready');
    expect(second.status).toBe('ready');
    // One indexing run per call, no double-writing inside a single run.
    expect(indexUserMock).toHaveBeenCalledTimes(2);
  });

  it('collapses concurrent triggers for the same user into one indexing run', async () => {
    const supabase = makeSupabase();

    const [a, b, c] = await Promise.all([
      reindexUser('user-1', supabase, { force: true }),
      reindexUser('user-1', supabase, { force: true }),
      reindexUser('user-1', supabase, { force: true }),
    ]);

    expect(indexUserMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('does not share the in-flight run across different users', async () => {
    const supabase = makeSupabase();
    await Promise.all([
      reindexUser('user-1', supabase, { force: true }),
      reindexUser('user-2', supabase, { force: true }),
    ]);
    expect(indexUserMock).toHaveBeenCalledTimes(2);
  });

  it('returns a failed result without throwing for a missing userId', async () => {
    const result = await reindexUser('', makeSupabase(), { force: true });
    expect(result.ok).toBe(false);
    expect(indexUserMock).not.toHaveBeenCalled();
  });
});

describe('reindexStaleUsers', () => {
  it('reindexes each stale user returned by the sweep query', async () => {
    const supabase = makeSupabase({ userRows: [{ id: 'user-1' }, { id: 'user-2' }] });
    const results = await reindexStaleUsers(supabase);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(indexUserMock).toHaveBeenCalledTimes(2);
  });

  it('returns [] when the sweep query fails', async () => {
    const supabase = makeSupabase({ failRead: true });
    await expect(reindexStaleUsers(supabase)).resolves.toEqual([]);
  });
});
