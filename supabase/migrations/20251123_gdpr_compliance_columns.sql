-- Add GDPR compliance columns to profiles table
-- These columns track user consent for data processing and marketing communications

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gdpr_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gdpr_accepted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marketing_opt_in_at TIMESTAMPTZ;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_profiles_gdpr_accepted ON profiles (gdpr_accepted) WHERE gdpr_accepted = true;
CREATE INDEX IF NOT EXISTS idx_profiles_marketing_opt_in ON profiles (marketing_opt_in) WHERE marketing_opt_in = true;

-- Add comments for documentation
COMMENT ON COLUMN profiles.gdpr_accepted IS 'User accepted Terms of Service and Privacy Policy';
COMMENT ON COLUMN profiles.gdpr_accepted_at IS 'Timestamp when user accepted Terms of Service and Privacy Policy';
COMMENT ON COLUMN profiles.marketing_opt_in IS 'User opted in to receive marketing communications';
COMMENT ON COLUMN profiles.marketing_opt_in_at IS 'Timestamp when user opted in to marketing communications';
