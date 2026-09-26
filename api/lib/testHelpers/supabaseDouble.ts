/// <reference lib="dom" />
/**
 * Tiny Supabase client double shared by the per-module route tests.
 *
 * Deliberately table-aware: `maybeSingle()` on `users` serves the configured
 * tier row (so `requireTier` passes), while every other table returns whatever
 * the test put in `selectMaybeSingle`. That is enough to drive the 400/401/403/
 * 404/200 branches of each domain module without a live database.
 */
export type DoubleResult = { data?: any; error?: any };

export interface DoubleOptions {
  /** Row served for `from('users').select(...).maybeSingle()`. */
  usersRow?: any;
  /** Per-table payload for `select().eq().maybeSingle()`. */
  selectMaybeSingle?: Record<string, DoubleResult>;
  /** Payload for `insert().select().single()`. */
  insertSingle?: DoubleResult;
  /** Payload for `update().select().single()`. */
  updateSingle?: DoubleResult;
  /** Payload for an awaited delete chain. */
  deleteResult?: DoubleResult;
  /** Payload for an awaited upsert chain. */
  upsertResult?: DoubleResult;
  /** Result of `storage.from(...).upload(...)`. */
  storageUpload?: DoubleResult;
}

export const STRATEGIST_ROW = {
  role: 'user',
  subscription_tier: 'strategist',
  subscription_expires_at: null,
};

export function makeSupabaseDouble(options: DoubleOptions = {}) {
  const usersRow = options.usersRow ?? STRATEGIST_ROW;
  const storageUpload = options.storageUpload ?? { error: null };

  function builder(kind: 'select' | 'insert' | 'update' | 'delete' | 'upsert', table: string) {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: () =>
        Promise.resolve(
          table === 'users' && kind === 'select'
            ? { data: usersRow, error: null }
            : options.selectMaybeSingle?.[table] ?? { data: null, error: null },
        ),
      single: () => {
        if (kind === 'insert') return Promise.resolve(options.insertSingle ?? { data: null, error: null });
        if (kind === 'update') return Promise.resolve(options.updateSingle ?? { data: null, error: null });
        return Promise.resolve({ data: null, error: null });
      },
      then: (onFulfilled: any) => {
        if (kind === 'delete') return Promise.resolve(options.deleteResult ?? { error: null }).then(onFulfilled);
        if (kind === 'upsert') return Promise.resolve(options.upsertResult ?? { error: null }).then(onFulfilled);
        return Promise.resolve({ data: null, error: null }).then(onFulfilled);
      },
    };
    return chain;
  }

  const client: any = {
    from: (table: string) => ({
      select: () => builder('select', table),
      insert: () => builder('insert', table),
      update: () => builder('update', table),
      delete: () => builder('delete', table),
      upsert: () => builder('upsert', table),
    }),
    auth: {
      admin: { deleteUser: async () => ({ data: { user: null }, error: null }) },
    },
    storage: {
      from: () => ({
        upload: async () => storageUpload,
        getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.example/photo.png' } }),
        list: async () => ({ data: [], error: null }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
    rpc: async () => ({ data: 0, error: null }),
  };

  return client;
}

/** UUIDs are shape-checked by the handlers, so they must be real-looking. */
export const USER_A = '550e8400-e29b-41d4-a716-446655440000';
export const USER_B = '660e8400-e29b-41d4-a716-446655440001';
export const ANALYSIS_ID = '770e8400-e29b-41d4-a716-446655440002';
