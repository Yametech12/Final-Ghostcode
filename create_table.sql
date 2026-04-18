CREATE TABLE IF NOT EXISTS oracle_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  input JSONB,
  result JSONB,
  scenario_summary TEXT
);

ALTER TABLE oracle_analyses ENABLE ROW LEVEL SECURITY;

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