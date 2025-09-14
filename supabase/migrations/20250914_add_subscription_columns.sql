-- Migration: Add MailerLite webhook subscription columns to profiles table
-- Date: 2025-09-14
-- Purpose: Support MailerLite webhook profile syncing with subscription tiers and status

-- Add subscription-related columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS bounce_reason text;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);

-- Add comments for documentation
COMMENT ON COLUMN profiles.subscription_tier IS 'User subscription tier from MailerLite (free, premium, enterprise, etc.)';
COMMENT ON COLUMN profiles.status IS 'User status (active, inactive, unsubscribed, deleted)';
COMMENT ON COLUMN profiles.bounce_reason IS 'Reason for email bounce (mailbox_full, invalid_email, etc.)';

-- Update existing profiles to have default values
UPDATE profiles 
SET 
    subscription_tier = COALESCE(subscription_tier, 'free'),
    status = COALESCE(status, 'active')
WHERE subscription_tier IS NULL OR status IS NULL;
