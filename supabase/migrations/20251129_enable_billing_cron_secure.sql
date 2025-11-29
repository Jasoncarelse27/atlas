-- Migration: Enable secure billing overage cron job (Function-based)
-- Date: 2025-11-29
-- 
-- Purpose:
--   - Create secure function to call billing overage endpoint
--   - Schedule cron job to run daily at 02:00 UTC
--   - Uses internal_config table for secret storage (secure, not in git)
--   - Fully authenticated with Authorization: Bearer header
--
-- Prerequisites:
--   1. internal_config table must exist (created in Step 1)
--   2. internal_billing_secret must be set in internal_config table
--   3. pg_cron and pg_net extensions must be available
--
-- Safety:
--   - Idempotent (safe to re-run)
--   - Only creates function and schedules cron job
--   - No impact on users, auth, chat, tiers, or sync
--   - Replaces any existing billing-cycle-overage job

-- Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create secure function to call billing endpoint
CREATE OR REPLACE FUNCTION call_billing_overage_cycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  billing_secret TEXT;
  response_id BIGINT;
BEGIN
  -- Get secret from config table
  SELECT value INTO billing_secret
  FROM internal_config
  WHERE key = 'internal_billing_secret';
  
  IF billing_secret IS NULL OR billing_secret = '' THEN
    RAISE EXCEPTION 'internal_billing_secret not configured in internal_config table';
  END IF;

  -- Call the billing endpoint via pg_net
  SELECT net.http_post(
    url := 'https://atlas-production-2123.up.railway.app/internal/billing/run-overage-cycle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || billing_secret
    )::jsonb
  ) INTO response_id;
  
  -- Log the request ID (appears in Supabase logs)
  RAISE NOTICE 'Billing cycle request sent, response_id: %', response_id;
END;
$$;

-- Schedule the cron job
DO $$
DECLARE
  job_exists BOOLEAN;
BEGIN
  -- Clean up any previous version
  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'billing-cycle-overage'
  ) INTO job_exists;
  
  IF job_exists THEN
    PERFORM cron.unschedule('billing-cycle-overage');
  END IF;

  -- Schedule the cron job to call the function
  PERFORM cron.schedule(
    'billing-cycle-overage',
    '0 2 * * *',  -- every day at 02:00 UTC
    'SELECT call_billing_overage_cycle();'
  );
  
  RAISE NOTICE 'Successfully scheduled billing-cycle-overage cron job';
END $$;

-- Add helpful comments
COMMENT ON FUNCTION call_billing_overage_cycle() IS 'Calls internal billing endpoint to process overage charges. Called by pg_cron daily at 02:00 UTC.';

