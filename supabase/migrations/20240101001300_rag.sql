-- =============================================================================
-- 20240101001300_rag.sql — Retrieval-Augmented Generation storage
-- =============================================================================
-- Adds the embedding store used by api/lib/rag/* to ground advisor replies in
-- the user's own calibration, field-report and favorites data.
--
-- REQUIREMENTS
--   * pgvector (Supabase: enabled by default, `CREATE EXTENSION vector;`)
--   * If your Postgres build cannot install pgvector, run this migration with
--     the `embedding` column changed to `DOUBLE PRECISION[]`; the retrieval
--     code reads vectors through `parseVector()` which accepts both forms.
--
-- SAFETY
--   * Idempotent: every statement is IF NOT EXISTS / DROP POLICY IF EXISTS.
--   * No data loss: it only adds a table, two columns and policies.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- 1. Embedding store
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- auth.users is the root of the cascade chain (see 20240101000700_users_auth_fk)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1024),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, source_table, source_id, chunk_index)
);

COMMENT ON TABLE user_embeddings IS
  'Per-user RAG chunks. Written by the service role only; read via RLS for the owner.';
COMMENT ON COLUMN user_embeddings.embedding IS
  'pgvector(1024). May be NULL when an embedding provider was unavailable at write time.';

CREATE INDEX IF NOT EXISTS user_embeddings_user_idx ON user_embeddings(user_id);
CREATE INDEX IF NOT EXISTS user_embeddings_source_idx
  ON user_embeddings(user_id, source_table, source_id);

-- Anonymous and cross-user access is never allowed on personal embeddings.
ALTER TABLE user_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own embeddings" ON user_embeddings;
CREATE POLICY "users read own embeddings" ON user_embeddings
  FOR SELECT USING (auth.uid() = user_id);

-- Users may opt out by deleting their own rows directly from the client.
DROP POLICY IF EXISTS "users delete own embeddings" ON user_embeddings;
CREATE POLICY "users delete own embeddings" ON user_embeddings
  FOR DELETE USING (auth.uid() = user_id);

-- Note: no INSERT/UPDATE policy is created on purpose. The indexer writes with
-- the service-role key (which bypasses RLS), so client-side writes stay blocked.

-- -----------------------------------------------------------------------------
-- 2. Per-user indexing state + RAG privacy preference
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS embedding_status TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_indexed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.embedding_status IS
  'RAG index state for this user: NULL (never indexed), ready, or failed.';
COMMENT ON COLUMN users.last_indexed_at IS
  'Completion timestamp of the last successful index run (used by the stale sweep).';
COMMENT ON COLUMN users.preferences IS
  'User-controlled feature flags. Currently: { "useRagForAdvisor": boolean } (default true).';

-- The cron sweep filters on staleness; the index keeps that scan cheap.
CREATE INDEX IF NOT EXISTS users_last_indexed_at_idx ON users(last_indexed_at);

-- Keep the status column to a known set of values without breaking existing rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_embedding_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_embedding_status_check
      CHECK (embedding_status IS NULL OR embedding_status IN ('ready', 'failed'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Verification helpers (run manually)
-- -----------------------------------------------------------------------------
--   select count(*) from user_embeddings;
--   select source_table, count(*) from user_embeddings group by 1;
--   select id, embedding_status, last_indexed_at from users order by last_indexed_at desc nulls first limit 10;
--   -- similarity search sanity check (replace <uid> / <query vector>):
--   select source_table, source_id, 1 - (embedding <=> '[0,0,...]'::vector) as similarity
--   from user_embeddings where user_id = '<uid>' order by embedding <=> '[0,0,...]'::vector limit 5;
