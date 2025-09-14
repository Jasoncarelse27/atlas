
-- Drop indexes first
DROP INDEX IF EXISTS idx_profiles_subscription_tier;
DROP INDEX IF EXISTS idx_profiles_status;
DROP INDEX IF EXISTS idx_profiles_updated_at;

-- Drop columns
ALTER TABLE profiles
  DROP COLUMN IF EXISTS subscription_tier,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS bounce_reason;
