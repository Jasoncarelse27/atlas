-- Verification Script: Check billing cron job status
-- Safe read-only query to verify the billing cron fix
-- Run this in Supabase SQL Editor to confirm no billing cron jobs exist

-- Check for any cron jobs related to billing/overage
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  nodename,
  nodeport
FROM cron.job
WHERE command LIKE '%billing%' 
   OR command LIKE '%overage%'
   OR command LIKE '%run-overage-cycle%'
   OR jobname LIKE '%billing%'
   OR jobname LIKE '%overage%'
ORDER BY jobid;

-- Expected result: 0 rows (no billing cron jobs found)
-- If you see rows, those jobs are still active and may need to be disabled

-- Also show all active cron jobs for reference
SELECT 
  COUNT(*) as total_active_jobs,
  COUNT(*) FILTER (WHERE jobname LIKE '%billing%' OR jobname LIKE '%overage%') as billing_related_jobs
FROM cron.job
WHERE active = true;

-- Expected: billing_related_jobs should be 0

