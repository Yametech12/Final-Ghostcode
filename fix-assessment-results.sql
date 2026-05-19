-- ============================================================
-- FIX: assessment_results table schema
-- ============================================================
-- The code inserts: { user_id, type_id, answers }
-- But the table currently has a wrong "result" column.
-- This SQL recreates the table with the correct schema.
--
-- IMPORTANT: If assessment_results has existing data you want to keep,
-- run the SELECT first to back it up, then use ALTER TABLE instead.
-- ============================================================

-- Step 1: Check current schema (run this first)
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'assessment_results';

-- Step 2: If the table has a "result" column instead of "answers", run:
-- (uncomment the line below after reviewing)

-- DROP TABLE IF EXISTS assessment_results;
-- CREATE TABLE assessment_results (
--   id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--   type_id     TEXT        NOT NULL,
--   answers     JSONB       NOT NULL DEFAULT '{}',
--   created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- Step 3: Add RLS
-- ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can insert their own assessment results"
--   ON assessment_results FOR INSERT
--   WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users can read their own assessment results"
--   ON assessment_results FOR SELECT
--   USING (auth.uid() = user_id);

-- ============================================================
-- FIX: advisor_sessions table schema check
-- ============================================================
-- The code uses: id, user_id, title, timestamp
-- Run to see current columns:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'advisor_sessions';

-- ============================================================
-- FIX: advisor_messages table schema check
-- ============================================================
-- The code uses: id, session_id, user_id, role, content, timestamp
-- Run to see current columns:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'advisor_messages';

-- ============================================================
-- FIX: calibrations table schema check
-- ============================================================
-- Run to see current columns:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'calibrations';

-- ============================================================
-- VEST AUTH: How to populate user email
-- ============================================================
-- Vest doesn't use Supabase Auth — users are created via
-- EnhancedAuthContext.loadUserData() which calls POST /auth/vest-signin
-- or similar. The email comes from Vest's user object.
--
-- To get email populated, update your Vest auth callback to pass email:
-- In EnhancedAuthContext, find where user is created and add:
--   email: supabaseUser.email || vestUserObject.email || null,
--
-- Or run this to manually update existing users (if you know their emails):
-- UPDATE users SET email = 'actual@email.com' WHERE id = 'user-uuid-here';
