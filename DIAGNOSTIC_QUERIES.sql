-- ==========================================================
-- Atlas Billing Usage Diagnostic Queries
-- ==========================================================
-- Run these queries in Supabase SQL Editor to diagnose billing issues
-- ==========================================================

-- 1. Check if usage_logs table has the correct columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'usage_logs'
ORDER BY ordinal_position;

-- 2. Check ALL usage_logs entries (including 0 tokens for debugging)
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
ORDER BY COALESCE(created_at, timestamp) DESC
LIMIT 50;

-- 3. Check if ANY tokens have been recorded (should show recent messages)
SELECT 
  COUNT(*) as total_logs,
  SUM(tokens_used) as total_tokens,
  COUNT(CASE WHEN tokens_used > 0 THEN 1 END) as logs_with_tokens,
  MAX(COALESCE(created_at, timestamp)) as latest_log
FROM usage_logs;

-- 4. Check usage_snapshots table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'usage_snapshots'
ORDER BY ordinal_position;

-- 5. Check if billing_periods table exists (required for usage_snapshots)
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'billing_periods'
) as billing_periods_exists;

-- 6. Check if upsert_usage_snapshot function exists
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'upsert_usage_snapshot';

-- 7. Check recent messages to see if they're being created
SELECT 
  id,
  user_id,
  conversation_id,
  role,
  content_preview,
  created_at
FROM messages
ORDER BY created_at DESC
LIMIT 10;

-- 8. Check if there are any errors in the logs (if error_logs table exists)
SELECT * FROM error_logs
ORDER BY timestamp DESC
LIMIT 20;

