-- =====================================================================
-- RLS (Row Level Security) Audit Script for Epimetheus
-- =====================================================================
-- Run this in your Supabase SQL Editor to verify all tables have proper
-- security policies. Any table flagged below should have RLS enabled.
-- =====================================================================

-- 1. Check which tables have RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  CASE WHEN rowsecurity THEN '✅' ELSE '❌ MISSING RLS' END AS status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity DESC, tablename;

-- 2. Check existing policies per table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd AS operation,
  qual AS using_clause,
  with_check AS check_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================================
-- ENABLE RLS + ADD POLICIES (if not already done)
-- =====================================================================

-- ──────────────────────────────────────────────────────────────────────
-- USERS table
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ──────────────────────────────────────────────────────────────────────
-- ASSESSMENT_RESULTS table
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS assessment_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own assessments" ON assessment_results;
CREATE POLICY "Users can view own assessments" ON assessment_results
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own assessments" ON assessment_results;
CREATE POLICY "Users can insert own assessments" ON assessment_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own assessments" ON assessment_results;
CREATE POLICY "Users can delete own assessments" ON assessment_results
  FOR DELETE USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────
-- CALIBRATIONS table
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS calibrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own calibrations" ON calibrations;
CREATE POLICY "Users can view own calibrations" ON calibrations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own calibrations" ON calibrations;
CREATE POLICY "Users can insert own calibrations" ON calibrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own calibrations" ON calibrations;
CREATE POLICY "Users can delete own calibrations" ON calibrations
  FOR DELETE USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────
-- ORACLE_ANALYSES table
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS oracle_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own analyses" ON oracle_analyses;
CREATE POLICY "Users can view own analyses" ON oracle_analyses
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own analyses" ON oracle_analyses;
CREATE POLICY "Users can insert own analyses" ON oracle_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own analyses" ON oracle_analyses;
CREATE POLICY "Users can update own analyses" ON oracle_analyses
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own analyses" ON oracle_analyses;
CREATE POLICY "Users can delete own analyses" ON oracle_analyses
  FOR DELETE USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────
-- ADVISOR_SESSIONS table
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS advisor_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sessions" ON advisor_sessions;
CREATE POLICY "Users can view own sessions" ON advisor_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON advisor_sessions;
CREATE POLICY "Users can insert own sessions" ON advisor_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON advisor_sessions;
CREATE POLICY "Users can update own sessions" ON advisor_sessions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON advisor_sessions;
CREATE POLICY "Users can delete own sessions" ON advisor_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────
-- ADVISOR_MESSAGES table
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS advisor_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own messages" ON advisor_messages;
CREATE POLICY "Users can view own messages" ON advisor_messages
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own messages" ON advisor_messages;
CREATE POLICY "Users can insert own messages" ON advisor_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own messages" ON advisor_messages;
CREATE POLICY "Users can delete own messages" ON advisor_messages
  FOR DELETE USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────
-- FAVORITES table (if exists)
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own favorites" ON favorites;
CREATE POLICY "Users can manage own favorites" ON favorites
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────
-- DOSSIERS table (if exists)
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS dossiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own dossiers" ON dossiers;
CREATE POLICY "Users can manage own dossiers" ON dossiers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- STORAGE BUCKET POLICIES
-- =====================================================================

-- user-uploads bucket: users can only upload to their own folder
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
CREATE POLICY "Users can upload to own folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-uploads' 
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
CREATE POLICY "Users can update own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Public can view profile photos" ON storage.objects;
CREATE POLICY "Public can view profile photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-uploads');

-- =====================================================================
-- VERIFICATION: Re-run the audit to confirm everything is locked down
-- =====================================================================

SELECT 
  tablename,
  rowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND pg_policies.tablename = pg_tables.tablename) AS policy_count,
  CASE 
    WHEN NOT rowsecurity THEN '❌ RLS DISABLED'
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND pg_policies.tablename = pg_tables.tablename) = 0 THEN '⚠️ RLS ON BUT NO POLICIES'
    ELSE '✅ SECURED'
  END AS status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
