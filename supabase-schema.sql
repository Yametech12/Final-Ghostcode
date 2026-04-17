-- Supabase Database Schema (with IF NOT EXISTS)
-- Run this SQL in your Supabase SQL Editor to create the tables

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
  user_id UUID REFERENCES users(id),
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
  scenario TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  likes INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0
);

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

-- RLS Policies (these will be created only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can read/write their own data') THEN
    CREATE POLICY "Users can read/write their own data" ON users FOR ALL USING (auth.uid()::text = uid);
  END IF;
END $$;

-- Note: The rest of the policies, indexes, and functions from the original schema should be added here
-- but wrapped in DO $$ blocks to handle "already exists" errors