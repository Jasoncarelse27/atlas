-- Rollback Migration: Remove subscription columns from profiles table
-- Date: 2025-09-14
-- Purpose: Rollback subscription columns if issues occur
-- WARNING: This will permanently delete subscription data

-- Drop indexes first (PostgreSQL requirement)
DROP INDEX IF EXISTS idx_profiles_subscription_tier;
DROP INDEX IF EXISTS idx_profiles_status;
DROP INDEX IF EXISTS idx_profiles_updated_at;

-- Drop columns
ALTER TABLE profiles
  DROP COLUMN IF EXISTS bounce_reason,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS subscription_tier;

-- Log rollback completion
INSERT INTO public.migration_log (migration_name, action, executed_at) 
VALUES ('20250914_subscription_columns', 'rollback', NOW())
ON CONFLICT DO NOTHING;
