-- Rollback Migration: Remove subscription columns from profiles table
-- This rollback removes the subscription_tier, status, and bounce_reason columns
-- that were added in the forward migration 20250914_add_subscription_columns.sql

-- Drop indexes first (in reverse order of creation)
DROP INDEX IF EXISTS idx_profiles_updated_at;
DROP INDEX IF EXISTS idx_profiles_status;
DROP INDEX IF EXISTS idx_profiles_subscription_tier;

-- Remove columns (in reverse order of addition)
ALTER TABLE profiles
  DROP COLUMN IF EXISTS bounce_reason,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS subscription_tier;

-- Log the rollback operation
INSERT INTO migration_log (migration_name, operation, executed_at, executed_by)
VALUES (
  '20250914_rollback_subscription_columns',
  'ROLLBACK',
  NOW(),
  'manual-rollback-workflow'
) ON CONFLICT DO NOTHING;