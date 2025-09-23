-- Create retry_logs table for comprehensive upload retry analytics
CREATE TABLE IF NOT EXISTS retry_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('dexie-sync','edge-retry','cron')),
  attempted_count int DEFAULT 0,
  success_count int DEFAULT 0,
  failed_count int DEFAULT 0,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE retry_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own retry logs"
ON retry_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own retry logs"
ON retry_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow service role to do everything (for Edge Functions)
CREATE POLICY "Service role can do all"
ON retry_logs FOR ALL
USING (true);

-- Index for quick dashboard queries
CREATE INDEX IF NOT EXISTS idx_retry_logs_created_at ON retry_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retry_logs_source ON retry_logs(source);
CREATE INDEX IF NOT EXISTS idx_retry_logs_user_id ON retry_logs(user_id);

-- Verify the table was created
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'retry_logs' 
ORDER BY ordinal_position;
