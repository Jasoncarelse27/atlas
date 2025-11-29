-- Migration: Disable billing overage cron job (suppress pg_cron 401 noise)
-- Date: 2025-11-29
-- 
-- Purpose:
--   - Find and unschedule any pg_cron job calling /internal/billing/run-overage-cycle
--   - Prevents 401 spam in backend logs
--   - Zero impact on users, billing data, or any other system
--   - Fully reversible (can re-enable later with proper auth)
--
-- Safety:
--   - Idempotent (safe to run multiple times)
--   - Only touches pg_cron job scheduling
--   - No schema changes, no RLS changes, no data changes
--   - Does not affect other cron jobs (daily cleanup, profile self-heal, etc.)

-- Ensure pg_cron extension exists (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  job_record RECORD;
  jobs_found INTEGER := 0;
BEGIN
  -- Find all cron jobs that might be calling the billing endpoint
  -- pg_cron stores commands as text, so we search for the endpoint URL pattern
  FOR job_record IN
    SELECT jobid, jobname, command
    FROM cron.job
    WHERE command LIKE '%run-overage-cycle%'
       OR command LIKE '%billing/run-overage-cycle%'
       OR jobname LIKE '%billing%overage%'
       OR jobname LIKE '%overage%billing%'
  LOOP
    -- Unschedule each matching job
    PERFORM cron.unschedule(job_record.jobid);
    jobs_found := jobs_found + 1;
    RAISE NOTICE 'Unschedule cron job: % (jobid: %)', job_record.jobname, job_record.jobid;
  END LOOP;

  IF jobs_found = 0 THEN
    RAISE NOTICE 'No billing cron jobs found to disable (this is OK - may already be disabled)';
  ELSE
    RAISE NOTICE 'Successfully disabled % billing cron job(s)', jobs_found;
  END IF;
END $$;

