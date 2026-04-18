-- Supabase Database Schema (with IF NOT EXISTS)
-- Run this SQL in your Supabase SQL Editor to create the tables and storage
-- Note: Storage bucket creation requires running additional SQL after table creation

-- Note: Supabase automatically handles JWT secrets and RLS

-- Users table (equivalent to Firestore 'users' collection)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  display_name TEXT,
  photo_url TEXT,
  bio TEXT,
  contact_info JSONB,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Calibrations table (equivalent to 'calibrations' collection)
CREATE TABLE IF NOT EXISTS calibrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type_id TEXT NOT NULL,
  answers JSONB,
  traits JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Oracle analyses table
CREATE TABLE IF NOT EXISTS oracle_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  input JSONB NOT NULL,
  result JSONB NOT NULL,
  scenario_summary TEXT
);

-- Feedback table
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

-- Field reports table
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

-- Add title column if it doesn't exist (for existing tables)
ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS title TEXT;

-- Set default title from scenario for existing rows
UPDATE field_reports SET title = scenario WHERE title IS NULL;

-- Report likes table
CREATE TABLE IF NOT EXISTS report_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES field_reports(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, report_id)
);

-- Field report comments table
CREATE TABLE IF NOT EXISTS field_report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES field_reports(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Favorites table
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

-- Dossiers table
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

-- Advisor sessions table
CREATE TABLE IF NOT EXISTS advisor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advisor messages table
CREATE TABLE IF NOT EXISTS advisor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES advisor_sessions(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'model')),
  content TEXT NOT NULL,
  image_urls JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Assessment results table
CREATE TABLE IF NOT EXISTS assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type_id TEXT NOT NULL,
  answers JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Verification codes table
CREATE TABLE IF NOT EXISTS verification_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL CHECK (length(code) = 6),
  expires_at BIGINT NOT NULL
);

-- Public config table
CREATE TABLE IF NOT EXISTS public_config (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- Private config table (admin only)
CREATE TABLE IF NOT EXISTS private_config (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- Supabase Storage Configuration
-- Note: Run these commands in Supabase SQL Editor to create storage buckets

-- Create storage bucket for user uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-uploads',
  'user-uploads',
  true,
  5242880, -- 5MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Row Level Security Policies (only add if not already enabled)
DO $$
BEGIN
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE calibrations ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE oracle_analyses ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE field_reports ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE report_likes ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE field_report_comments ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE dossiers ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE advisor_sessions ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE advisor_messages ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Performance Indexes
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

-- RLS Policies (these will be created only if they don't exist)

-- Users table policies - FIXED: No infinite recursion (explicit text casting on both sides)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read/write their own data" ON users;
  CREATE POLICY "Users can read/write their own data" ON users FOR ALL USING (auth.uid()::text = uid::text);
END $$;

-- Calibrations policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calibrations' AND policyname = 'Users can read/write their own calibrations') THEN
    CREATE POLICY "Users can read/write their own calibrations" ON calibrations FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Oracle analyses policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'oracle_analyses' AND policyname = 'Users can read/write their own analyses') THEN
    CREATE POLICY "Users can read/write their own analyses" ON oracle_analyses FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Feedback policies (allow anonymous feedback)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Anyone can create feedback') THEN
    CREATE POLICY "Anyone can create feedback" ON feedback FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Admins can read all feedback') THEN
    CREATE POLICY "Admins can read all feedback" ON feedback FOR SELECT USING (
      auth.jwt() ->> 'role' = 'admin'
    );
  END IF;
END $$;

-- Field reports policies (public read, authenticated write)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'field_reports' AND policyname = 'Anyone can read field reports') THEN
    CREATE POLICY "Anyone can read field reports" ON field_reports FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'field_reports' AND policyname = 'Authenticated users can create reports') THEN
    CREATE POLICY "Authenticated users can create reports" ON field_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'field_reports' AND policyname = 'Users can update their own reports') THEN
    CREATE POLICY "Users can update their own reports" ON field_reports FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Report likes policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'report_likes' AND policyname = 'Anyone can read likes') THEN
    CREATE POLICY "Anyone can read likes" ON report_likes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'report_likes' AND policyname = 'Authenticated users can manage their likes') THEN
    CREATE POLICY "Authenticated users can manage their likes" ON report_likes FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Field report comments policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'field_report_comments' AND policyname = 'Anyone can read comments') THEN
    CREATE POLICY "Anyone can read comments" ON field_report_comments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'field_report_comments' AND policyname = 'Authenticated users can create comments') THEN
    CREATE POLICY "Authenticated users can create comments" ON field_report_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'field_report_comments' AND policyname = 'Users can update their own comments') THEN
    CREATE POLICY "Users can update their own comments" ON field_report_comments FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Favorites policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can manage their own favorites') THEN
    CREATE POLICY "Users can manage their own favorites" ON favorites FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Dossiers policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dossiers' AND policyname = 'Users can manage their own dossiers') THEN
    CREATE POLICY "Users can manage their own dossiers" ON dossiers FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Advisor sessions policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'advisor_sessions' AND policyname = 'Users can manage their own sessions') THEN
    CREATE POLICY "Users can manage their own sessions" ON advisor_sessions FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Advisor messages policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'advisor_messages' AND policyname = 'Users can manage their own messages') THEN
    CREATE POLICY "Users can manage their own messages" ON advisor_messages FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Assessment results policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assessment_results' AND policyname = 'Users can manage their own assessment results') THEN
    CREATE POLICY "Users can manage their own assessment results" ON assessment_results FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Verification codes policies (service role only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'verification_codes' AND policyname = 'Service role can manage verification codes') THEN
    CREATE POLICY "Service role can manage verification codes" ON verification_codes FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Public config policies (read-only for all, write only for admins)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'public_config' AND policyname = 'Anyone can read public config') THEN
    CREATE POLICY "Anyone can read public config" ON public_config FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'public_config' AND policyname = 'Admins can manage public config') THEN
    CREATE POLICY "Admins can manage public config" ON public_config FOR ALL USING (
      auth.jwt() ->> 'role' = 'admin'
    );
  END IF;
END $$;

-- Private config policies (admin only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'private_config' AND policyname = 'Admins can manage private config') THEN
    CREATE POLICY "Admins can manage private config" ON private_config FOR ALL USING (
      auth.jwt() ->> 'role' = 'admin'
    );
  END IF;
END $$;

-- Storage policies for user-uploads bucket
DO $$
BEGIN
  -- Allow authenticated users to upload their own files
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can upload their own files') THEN
    CREATE POLICY "Users can upload their own files" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'user-uploads' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  -- Allow users to read their own files
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can read their own files') THEN
    CREATE POLICY "Users can read their own files" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'user-uploads' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  -- Allow users to update their own files
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can update their own files') THEN
    CREATE POLICY "Users can update their own files" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'user-uploads' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  -- Allow users to delete their own files
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can delete their own files') THEN
    CREATE POLICY "Users can delete their own files" ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'user-uploads' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;