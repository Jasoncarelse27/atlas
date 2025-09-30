-- Create monitoring_logs table for Atlas monitoring system
CREATE TABLE IF NOT EXISTS monitoring_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'unhealthy', 'warning')),
  details JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_monitoring_logs_service_timestamp 
ON monitoring_logs(service, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_logs_status_timestamp 
ON monitoring_logs(status, timestamp DESC);

-- Add RLS policy for service role access
ALTER TABLE monitoring_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert monitoring logs
CREATE POLICY "Service role can insert monitoring logs" ON monitoring_logs
FOR INSERT WITH CHECK (true);

-- Allow service role to read monitoring logs
CREATE POLICY "Service role can read monitoring logs" ON monitoring_logs
FOR SELECT WITH CHECK (true);

-- Add comment
COMMENT ON TABLE monitoring_logs IS 'Stores monitoring and health check results from Atlas services';
