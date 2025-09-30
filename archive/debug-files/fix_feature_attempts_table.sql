-- Fix: Ensure feature_attempts table exists in Supabase
-- Run this in your Supabase SQL Editor

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS feature_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  feature text NOT NULL,
  tier text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE feature_attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own feature attempts" ON feature_attempts;
DROP POLICY IF EXISTS "Service role can manage all feature attempts" ON feature_attempts;

-- Create policies
CREATE POLICY "Users can view own feature attempts" ON feature_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all feature attempts" ON feature_attempts
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON feature_attempts TO authenticated;
GRANT ALL ON feature_attempts TO service_role;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_attempts_user_id ON feature_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_attempts_created_at ON feature_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_feature_attempts_tier ON feature_attempts(tier);
CREATE INDEX IF NOT EXISTS idx_feature_attempts_feature ON feature_attempts(feature);

-- Verify the table was created
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'feature_attempts' 
ORDER BY ordinal_position;
