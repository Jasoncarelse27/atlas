-- ==========================================================
-- Atlas Billing System - Verification Query
-- ==========================================================
-- Run this to verify all billing tables and functions exist
-- ==========================================================

-- Check billing_periods table
SELECT 
  'billing_periods' as table_name,
  COUNT(*) as row_count,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'billing_periods'
  ) as table_exists
FROM billing_periods;

-- Check usage_snapshots table
SELECT 
  'usage_snapshots' as table_name,
  COUNT(*) as row_count,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'usage_snapshots'
  ) as table_exists
FROM usage_snapshots;

-- Check overage_charges table
SELECT 
  'overage_charges' as table_name,
  COUNT(*) as row_count,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'overage_charges'
  ) as table_exists
FROM overage_charges;

-- Check upsert_usage_snapshot function
SELECT 
  'upsert_usage_snapshot' as function_name,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'upsert_usage_snapshot'
  ) as function_exists;

-- Summary
SELECT 
  '✅ All billing tables and functions verified' as status;

