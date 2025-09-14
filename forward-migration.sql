-- Forward Migration: Add subscription columns to profiles table
-- Date: 2025-09-14
-- Purpose: Support MailerLite webhook profile syncing

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS bounce_reason text;

COMMENT ON COLUMN profiles.subscription_tier IS 'User subscription tier synced from MailerLite';
COMMENT ON COLUMN profiles.status IS 'Account status (active, inactive, unsubscribed)';
COMMENT ON COLUMN profiles.bounce_reason IS 'Reason for email bounce (if any)';

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);

-- Update existing profiles to have default values
UPDATE profiles 
SET 
    subscription_tier = COALESCE(subscription_tier, 'free'),
    status = COALESCE(status, 'active')
WHERE subscription_tier IS NULL OR status IS NULL;
