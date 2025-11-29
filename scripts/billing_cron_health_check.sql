-- Billing Cron Job Health Check
-- Run this in Supabase SQL Editor to verify billing cron setup
-- Safe read-only queries - no changes made

-- 1. Check if cron job exists and is active
SELECT 
  'Cron Job Status' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Found'
    ELSE '❌ Not Found'
  END as status,
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname = 'billing-cycle-overage'
GROUP BY jobid, jobname, schedule, active, command;

-- 2. Verify the function exists
SELECT 
  'Function Status' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Found'
    ELSE '❌ Not Found'
  END as status,
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%internal_billing_secret%' THEN '✅ Uses secret from config'
    ELSE '⚠️ Secret check missing'
  END as secret_check
FROM pg_proc
WHERE proname = 'call_billing_overage_cycle'
GROUP BY proname, prosrc;

-- 3. Verify secret is stored (masked for security)
SELECT 
  'Secret Status' as check_type,
  CASE 
    WHEN COUNT(*) > 0 AND length(value) > 0 THEN '✅ Configured'
    WHEN COUNT(*) > 0 AND length(value) = 0 THEN '⚠️ Empty'
    ELSE '❌ Not Found'
  END as status,
  key,
  CASE 
    WHEN length(value) > 0 THEN '***' || right(value, 4) 
    ELSE 'EMPTY'
  END as secret_preview,
  updated_at
FROM internal_config
WHERE key = 'internal_billing_secret'
GROUP BY key, value, updated_at;

-- 4. Summary
SELECT 
  'Summary' as check_type,
  (SELECT COUNT(*) FROM cron.job WHERE jobname = 'billing-cycle-overage') as cron_jobs_found,
  (SELECT COUNT(*) FROM pg_proc WHERE proname = 'call_billing_overage_cycle') as functions_found,
  (SELECT COUNT(*) FROM internal_config WHERE key = 'internal_billing_secret' AND length(value) > 0) as secrets_configured,
  CASE 
    WHEN (SELECT COUNT(*) FROM cron.job WHERE jobname = 'billing-cycle-overage' AND active = true) > 0 
      AND (SELECT COUNT(*) FROM pg_proc WHERE proname = 'call_billing_overage_cycle') > 0
      AND (SELECT COUNT(*) FROM internal_config WHERE key = 'internal_billing_secret' AND length(value) > 0) > 0
    THEN '✅ All Systems Ready'
    ELSE '⚠️ Configuration Incomplete'
  END as overall_status;

