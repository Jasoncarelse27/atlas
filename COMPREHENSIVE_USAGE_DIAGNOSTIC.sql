-- ==========================================================
-- Comprehensive Usage Diagnostic Queries
-- ==========================================================
-- Run these queries in order to diagnose billing issues
-- ==========================================================

-- 1. Check ALL recent usage_logs (including 0 tokens)
SELECT 
  id,
  user_id,
  event,
  tier,
  feature,
  tokens_used,
  estimated_cost,
  metadata->>'model' as model,
  metadata->>'input_tokens' as input_tokens,
  metadata->>'output_tokens' as output_tokens,
  created_at,
  timestamp
FROM usage_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
   OR timestamp > NOW() - INTERVAL '1 hour'
ORDER BY COALESCE(created_at, timestamp) DESC
LIMIT 20;

-- 2. Check if ANY entries have tokens (all time)
SELECT 
  COUNT(*) as total_entries,
  COUNT(CASE WHEN tokens_used > 0 THEN 1 END) as entries_with_tokens,
  COUNT(CASE WHEN tokens_used = 0 THEN 1 END) as entries_with_zero_tokens,
  MAX(COALESCE(created_at, timestamp)) as latest_entry,
  MIN(COALESCE(created_at, timestamp)) as oldest_entry
FROM usage_logs;

-- 3. Check recent messages (to verify messages are being created)
SELECT 
  id,
  user_id,
  conversation_id,
  role,
  LEFT(content, 50) as content_preview,
  created_at
FROM messages
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check if backend is inserting (even with 0 tokens)
SELECT 
  event,
  COUNT(*) as count,
  SUM(tokens_used) as total_tokens,
  MAX(COALESCE(created_at, timestamp)) as latest
FROM usage_logs
WHERE COALESCE(created_at, timestamp) > NOW() - INTERVAL '1 hour'
GROUP BY event
ORDER BY latest DESC;

-- 5. Check for any database errors (if error_logs table exists)
SELECT * FROM error_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC
LIMIT 10;

