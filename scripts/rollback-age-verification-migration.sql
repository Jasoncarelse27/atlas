-- Rollback script for age verification migration
-- ONLY run this if you need to remove the age verification columns
-- WARNING: This will delete age verification data (but it's safe since we're not using it yet)

-- Drop index first
DROP INDEX IF EXISTS idx_profiles_age_verified;

-- Remove comments
COMMENT ON COLUMN profiles.age_verified IS NULL;
COMMENT ON COLUMN profiles.age_verified_at IS NULL;

-- Drop columns (only safe because no code uses them yet)
ALTER TABLE profiles DROP COLUMN IF EXISTS age_verified;
ALTER TABLE profiles DROP COLUMN IF EXISTS age_verified_at;

