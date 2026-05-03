-- Supabase Database Schema (Version 2 - Fixed)
-- Copy this entire file into Supabase SQL Editor and run it

-- Drop all policies on all tables first
DROP POLICY IF EXISTS "Users can read/write their own data" ON users;
DROP POLICY IF EXISTS "Admins can see all users" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;
DROP POLICY IF EXISTS "Admins can delete any user" ON users;

DROP POLICY IF EXISTS "Users can read/write their own calibrations" ON calibrations;
DROP POLICY IF EXISTS "Users can read/write their own analyses" ON oracle_analyses;

DROP POLICY IF EXISTS "Anyone can read feedback" ON feedback;
DROP POLICY IF EXISTS "Authenticated users can create feedback" ON feedback;
DROP POLICY IF EXISTS "Users can update their own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can delete their own feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can manage all feedback" ON feedback;

DROP POLICY IF EXISTS "Anyone can read field reports" ON field_reports;
DROP POLICY IF EXISTS "Authenticated users can create reports" ON field_reports;
DROP POLICY IF EXISTS "Users can update their own reports" ON field_reports;
DROP POLICY IF EXISTS "Users can delete their own reports" ON field_reports;
DROP POLICY IF EXISTS "Admins can delete any report" ON field_reports;

DROP POLICY IF EXISTS "Anyone can read likes" ON report_likes;
DROP POLICY IF EXISTS "Authenticated users can manage their likes" ON report_likes;

DROP POLICY IF EXISTS "Anyone can read comments" ON field_report_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON field_report_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON field_report_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON field_report_comments;

DROP POLICY IF EXISTS "Users can manage their own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can manage their own dossiers" ON dossiers;
DROP POLICY IF EXISTS "Users can manage their own sessions" ON advisor_sessions;
DROP POLICY IF EXISTS "Users can manage their own messages" ON advisor_messages;
DROP POLICY IF EXISTS "Users can manage their own assessment results" ON assessment_results;

DROP POLICY IF EXISTS "Service role can manage verification codes" ON verification_codes;

DROP POLICY IF EXISTS "Anyone can read public config" ON public_config;
DROP POLICY IF EXISTS "Admins can manage public config" ON public_config;

DROP POLICY IF EXISTS "Admins can manage private config" ON private_config;

-- Drop functions and triggers
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP TRIGGER IF EXISTS update_advisor_sessions_updated_at ON advisor_sessions;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop legacy uid column
ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS uid CASCADE;

-- Create tables
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  display_name TEXT,
  photo_url TEXT,
  bio TEXT,
  contact_info JSONB,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS calibrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type_id TEXT NOT NULL,
  answers JSONB,
  traits JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oracle_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  input JSONB NOT NULL,
  result JSONB NOT NULL,
  scenario_summary TEXT
);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT,
  email TEXT,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'general', 'praise', 'suggestion', 'content', 'ui', 'performance')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  url TEXT,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS field_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  scenario TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  likes INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS report_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES field_reports(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, report_id)
);

CREATE TABLE IF NOT EXISTS field_report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES field_reports(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('type', 'guide', 'calibration')),
  category TEXT NOT NULL CHECK (category IN ('Personality', 'Content', 'Assessment')),
  title TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id)
);

CREATE TABLE IF NOT EXISTS dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type_id TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('Intrigue', 'Arousal', 'Comfort', 'Devotion')),
  notes TEXT,
  last_interaction TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS advisor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS advisor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES advisor_sessions(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'model')),
  content TEXT NOT NULL,
  image_urls JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type_id TEXT NOT NULL,
  answers JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL CHECK (length(code) = 6),
  expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public_config (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS private_config (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- Backfill field_reports.title
ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS title TEXT;
UPDATE field_reports SET title = scenario WHERE title IS NULL;

-- Enable RLS
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS oracle_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS field_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS report_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS field_report_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS advisor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS advisor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS private_config ENABLE ROW LEVEL SECURITY;

-- Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.users WHERE id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_advisor_sessions_updated_at ON advisor_sessions;
CREATE TRIGGER update_advisor_sessions_updated_at
BEFORE UPDATE ON advisor_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
CREATE POLICY "Users can read/write their own data" ON users FOR ALL
USING (id = auth.uid());

CREATE POLICY "Admins can see all users" ON users FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins can update any user" ON users FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Admins can delete any user" ON users FOR DELETE
USING (public.is_admin());

CREATE POLICY "Users can read/write their own calibrations" ON calibrations FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users can read/write their own analyses" ON oracle_analyses FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read feedback" ON feedback FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create feedback" ON feedback FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own feedback" ON feedback FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback" ON feedback FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all feedback" ON feedback FOR ALL
USING (public.is_admin());

CREATE POLICY "Anyone can read field reports" ON field_reports FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create reports" ON field_reports FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own reports" ON field_reports FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports" ON field_reports FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any report" ON field_reports FOR DELETE
USING (public.is_admin());

CREATE POLICY "Anyone can read likes" ON report_likes FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage their likes" ON report_likes FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read comments" ON field_report_comments FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create comments" ON field_report_comments FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own comments" ON field_report_comments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON field_report_comments FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own favorites" ON favorites FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own dossiers" ON dossiers FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sessions" ON advisor_sessions FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own messages" ON advisor_messages FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own assessment results" ON assessment_results FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage verification codes" ON verification_codes FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can read public config" ON public_config FOR SELECT
USING (true);

CREATE POLICY "Admins can manage public config" ON public_config FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins can manage private config" ON private_config FOR ALL
USING (public.is_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calibrations_user_timestamp ON calibrations(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_analyses_user_timestamp ON oracle_analyses(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_field_reports_timestamp ON field_reports(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_field_reports_user_timestamp ON field_reports(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_advisor_sessions_user_updated ON advisor_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_advisor_messages_session_timestamp ON advisor_messages(session_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_favorites_user_content ON favorites(user_id, content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_user_created ON dossiers(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_likes_report ON report_likes(report_id);
