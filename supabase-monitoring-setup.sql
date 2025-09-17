-- Atlas Monitoring & Logging Tables Setup
-- Run this in your Supabase SQL Editor

-- 1. Error Logs Table
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  context JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  service VARCHAR(50) DEFAULT 'atlas-backend',
  environment VARCHAR(20) DEFAULT 'production',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_service ON error_logs(service);

-- 2. Monitoring Logs Table
CREATE TABLE IF NOT EXISTS monitoring_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'healthy', 'unhealthy', 'warning'
  details JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for monitoring queries
CREATE INDEX IF NOT EXISTS idx_monitoring_logs_timestamp ON monitoring_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_logs_service_status ON monitoring_logs(service, status);

-- 3. Performance Metrics Table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint VARCHAR(100) NOT NULL,
  response_time_ms INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  user_agent TEXT,
  ip_address INET,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance analysis
CREATE INDEX IF NOT EXISTS idx_performance_metrics_endpoint ON performance_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);

-- 4. System Health Snapshots Table
CREATE TABLE IF NOT EXISTS health_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service VARCHAR(50) NOT NULL,
  overall_status VARCHAR(20) NOT NULL,
  uptime_seconds BIGINT,
  memory_usage_mb INTEGER,
  database_status VARCHAR(20),
  response_time_ms INTEGER,
  checks JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for health monitoring
CREATE INDEX IF NOT EXISTS idx_health_snapshots_service ON health_snapshots(service);
CREATE INDEX IF NOT EXISTS idx_health_snapshots_timestamp ON health_snapshots(timestamp DESC);

-- 5. Alert History Table
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL, -- 'downtime', 'performance', 'error_rate'
  severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for alert queries
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_severity ON alert_history(severity);

-- 6. RLS Policies (Row Level Security)
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all monitoring data
CREATE POLICY "Service role can manage error logs" ON error_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage monitoring logs" ON monitoring_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage performance metrics" ON performance_metrics
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage health snapshots" ON health_snapshots
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage alert history" ON alert_history
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read monitoring data (for dashboard)
CREATE POLICY "Authenticated users can read error logs" ON error_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read monitoring logs" ON monitoring_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read health snapshots" ON health_snapshots
  FOR SELECT USING (auth.role() = 'authenticated');

-- 7. Helpful Views
CREATE OR REPLACE VIEW recent_errors AS
SELECT 
  error_message,
  service,
  environment,
  timestamp,
  context
FROM error_logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

CREATE OR REPLACE VIEW system_health_summary AS
SELECT 
  service,
  overall_status,
  AVG(response_time_ms) as avg_response_time,
  MAX(timestamp) as last_check,
  COUNT(*) as check_count
FROM health_snapshots
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY service, overall_status
ORDER BY last_check DESC;

-- 8. Functions for monitoring
CREATE OR REPLACE FUNCTION get_error_rate(
  service_name TEXT DEFAULT 'atlas-backend',
  time_window INTERVAL DEFAULT '1 hour'
)
RETURNS TABLE(
  error_count BIGINT,
  total_requests BIGINT,
  error_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH error_counts AS (
    SELECT COUNT(*) as errors
    FROM error_logs
    WHERE service = service_name
      AND timestamp > NOW() - time_window
  ),
  request_counts AS (
    SELECT COUNT(*) as requests
    FROM performance_metrics
    WHERE timestamp > NOW() - time_window
  )
  SELECT 
    ec.errors,
    rc.requests,
    CASE 
      WHEN rc.requests > 0 THEN ROUND((ec.errors::NUMERIC / rc.requests::NUMERIC) * 100, 2)
      ELSE 0
    END as rate
  FROM error_counts ec, request_counts rc;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Atlas monitoring tables created successfully!';
  RAISE NOTICE '📊 Tables created: error_logs, monitoring_logs, performance_metrics, health_snapshots, alert_history';
  RAISE NOTICE '🔐 RLS policies enabled for security';
  RAISE NOTICE '👁️ Views created: recent_errors, system_health_summary';
  RAISE NOTICE '⚡ Functions created: get_error_rate()';
END $$;
