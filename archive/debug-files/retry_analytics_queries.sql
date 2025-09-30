-- Atlas Upload Retry Analytics Dashboard Queries
-- Run these in Supabase SQL Editor for comprehensive retry monitoring

-- 1. 7-Day Retry Health Report
SELECT
  source,
  COUNT(*) as runs,
  SUM(attempted_count) as total_attempted,
  SUM(success_count) as total_success,
  SUM(failed_count) as total_failed,
  ROUND(
    (SUM(success_count)::float / NULLIF(SUM(attempted_count), 0)) * 100, 
    2
  ) as success_rate_percent
FROM retry_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY source
ORDER BY runs DESC;

-- 2. Hourly Retry Activity (Last 24 Hours)
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  source,
  COUNT(*) as runs,
  SUM(attempted_count) as attempted,
  SUM(success_count) as successful,
  SUM(failed_count) as failed
FROM retry_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), source
ORDER BY hour DESC, source;

-- 3. User-Specific Retry Stats (Top 10 Users with Most Retries)
SELECT
  p.email,
  COUNT(rl.*) as total_retry_runs,
  SUM(rl.attempted_count) as total_attempts,
  SUM(rl.success_count) as total_successes,
  SUM(rl.failed_count) as total_failures,
  ROUND(
    (SUM(rl.success_count)::float / NULLIF(SUM(rl.attempted_count), 0)) * 100, 
    2
  ) as success_rate_percent
FROM retry_logs rl
LEFT JOIN profiles p ON rl.user_id = p.id
WHERE rl.created_at > NOW() - INTERVAL '7 days'
  AND rl.user_id IS NOT NULL
GROUP BY p.email, rl.user_id
ORDER BY total_retry_runs DESC
LIMIT 10;

-- 4. Recent Retry Failures (Last 24 Hours)
SELECT
  rl.created_at,
  rl.source,
  rl.attempted_count,
  rl.success_count,
  rl.failed_count,
  rl.details->'failed' as failed_files,
  p.email as user_email
FROM retry_logs rl
LEFT JOIN profiles p ON rl.user_id = p.id
WHERE rl.created_at > NOW() - INTERVAL '24 hours'
  AND rl.failed_count > 0
ORDER BY rl.created_at DESC;

-- 5. Retry Source Performance Comparison
SELECT
  source,
  COUNT(*) as total_runs,
  AVG(attempted_count) as avg_attempts_per_run,
  AVG(success_count) as avg_successes_per_run,
  AVG(failed_count) as avg_failures_per_run,
  MIN(created_at) as first_run,
  MAX(created_at) as last_run
FROM retry_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY source
ORDER BY total_runs DESC;

-- 6. Daily Retry Trends (Last 30 Days)
SELECT
  DATE(created_at) as date,
  source,
  COUNT(*) as runs,
  SUM(attempted_count) as attempted,
  SUM(success_count) as successful,
  SUM(failed_count) as failed,
  ROUND(
    (SUM(success_count)::float / NULLIF(SUM(attempted_count), 0)) * 100, 
    2
  ) as success_rate_percent
FROM retry_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), source
ORDER BY date DESC, source;

-- 7. System Health Check (Current Status)
SELECT
  'Total Retry Runs (24h)' as metric,
  COUNT(*)::text as value
FROM retry_logs
WHERE created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Failed Uploads (24h)' as metric,
  SUM(failed_count)::text as value
FROM retry_logs
WHERE created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Success Rate (24h)' as metric,
  ROUND(
    (SUM(success_count)::float / NULLIF(SUM(attempted_count), 0)) * 100, 
    2
  )::text || '%' as value
FROM retry_logs
WHERE created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Last Retry Run' as metric,
  MAX(created_at)::text as value
FROM retry_logs;

-- 8. Detailed Retry Logs (Last 100 Entries)
SELECT
  rl.id,
  rl.created_at,
  rl.source,
  rl.attempted_count,
  rl.success_count,
  rl.failed_count,
  rl.details,
  p.email as user_email
FROM retry_logs rl
LEFT JOIN profiles p ON rl.user_id = p.id
ORDER BY rl.created_at DESC
LIMIT 100;
