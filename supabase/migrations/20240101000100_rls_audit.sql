-- =====================================================================
-- RLS audit & refinements (consolidated from scripts/rls-audit.sql)
--
-- Idempotent: drops policies before recreating them. Adds tighter,
-- per-operation policies that supersede the broad FOR ALL policies in
-- the previous migration where they overlap.
-- =====================================================================

-- Lock the admin helper down: only authenticated callers, never anon.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ──────────────────────────────────────────────────────────────────────
-- USERS table — owner read/write + admin overrides
-- ──────────────────────────────────────────────────────────────────────
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
-- ASSESSMENT_RESULTS
-- ──────────────────────────────────────────────────────────────────────
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
-- CALIBRATIONS
-- ──────────────────────────────────────────────────────────────────────
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
-- ORACLE_ANALYSES
-- ──────────────────────────────────────────────────────────────────────
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
-- ADVISOR_SESSIONS
-- ──────────────────────────────────────────────────────────────────────
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
-- ADVISOR_MESSAGES
-- ──────────────────────────────────────────────────────────────────────
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
-- FAVORITES + DOSSIERS (already covered by FOR ALL policies; reasserted
-- here so the audit migration is self-contained when re-run on a fresh
-- database that skipped the initial schema).
-- ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own favorites" ON favorites;
CREATE POLICY "Users can manage own favorites" ON favorites
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own dossiers" ON dossiers;
CREATE POLICY "Users can manage own dossiers" ON dossiers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- STORAGE BUCKET POLICIES — user-uploads
-- =====================================================================
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
-- USERS — admin overrides (additive; original owner policies still apply)
-- =====================================================================
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (public.is_admin());

-- These two already exist from the initial schema migration but are
-- restated here so this migration stays self-contained.
DROP POLICY IF EXISTS "Admins can update any user" ON users;
CREATE POLICY "Admins can update any user" ON users
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any user" ON users;
CREATE POLICY "Admins can delete any user" ON users
  FOR DELETE USING (public.is_admin());

-- =====================================================================
-- FIELD_REPORTS — granular per-operation policies + atomic comment-count
-- =====================================================================
DROP POLICY IF EXISTS "Anyone authenticated can view field reports" ON field_reports;
CREATE POLICY "Anyone authenticated can view field reports" ON field_reports
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own field reports" ON field_reports;
CREATE POLICY "Users can insert own field reports" ON field_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own field reports" ON field_reports;
CREATE POLICY "Users can update own field reports" ON field_reports
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own field reports" ON field_reports;
CREATE POLICY "Users can delete own field reports" ON field_reports
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can delete any field report" ON field_reports;
CREATE POLICY "Admins can delete any field report" ON field_reports
  FOR DELETE TO authenticated USING (public.is_admin());

-- Atomic comment-count incrementer. Replaces a racy client-side
-- read-modify-write that also required UPDATE rights on rows users
-- don't own.
CREATE OR REPLACE FUNCTION public.increment_field_report_comments(report_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.field_reports
  SET comment_count = COALESCE(comment_count, 0) + 1
  WHERE id = report_id;
$$;
REVOKE ALL ON FUNCTION public.increment_field_report_comments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_field_report_comments(uuid) TO authenticated;

-- =====================================================================
-- FIELD_REPORT_COMMENTS — granular policies
-- =====================================================================
DROP POLICY IF EXISTS "Anyone authenticated can view comments" ON field_report_comments;
CREATE POLICY "Anyone authenticated can view comments" ON field_report_comments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own comments" ON field_report_comments;
CREATE POLICY "Users can insert own comments" ON field_report_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON field_report_comments;
CREATE POLICY "Users can delete own comments" ON field_report_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can delete any comment" ON field_report_comments;
CREATE POLICY "Admins can delete any comment" ON field_report_comments
  FOR DELETE TO authenticated USING (public.is_admin());

-- =====================================================================
-- FEEDBACK — anonymous + authenticated insert, owner/admin read
-- =====================================================================
DROP POLICY IF EXISTS "Anonymous can submit feedback" ON feedback;
CREATE POLICY "Anonymous can submit feedback" ON feedback
  FOR INSERT TO anon WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "Authenticated can submit feedback" ON feedback;
CREATE POLICY "Authenticated can submit feedback" ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own feedback" ON feedback;
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;
CREATE POLICY "Admins can view all feedback" ON feedback
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete feedback" ON feedback;
CREATE POLICY "Admins can delete feedback" ON feedback
  FOR DELETE TO authenticated USING (public.is_admin());
