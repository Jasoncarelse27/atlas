-- Add age verification columns to profiles table
-- This column tracks user age verification for legal compliance (COPPA, GDPR)
-- Safe to run: Uses IF NOT EXISTS, defaults to FALSE, won't break existing users

-- Add columns with safe defaults
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;

-- Add index for efficient querying (only indexes verified users)
CREATE INDEX IF NOT EXISTS idx_profiles_age_verified ON profiles (age_verified) WHERE age_verified = true;

-- Add comments for documentation
COMMENT ON COLUMN profiles.age_verified IS 'User confirmed they are 18 years or older';
COMMENT ON COLUMN profiles.age_verified_at IS 'Timestamp when user confirmed age verification';

