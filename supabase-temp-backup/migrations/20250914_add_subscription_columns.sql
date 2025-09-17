-- Migration: Add subscription columns to profiles table
-- Date: 2025-09-14
-- Purpose: Support MailerLite webhook profile syncing
-- Rollback: Safe to rollback - drops columns if issues occur

-- Forward migration: Add subscription-related columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS bounce_reason TEXT;

-- Add documentation comments
COMMENT ON COLUMN profiles.subscription_tier IS 'User subscription tier (free, premium, enterprise)';
COMMENT ON COLUMN profiles.status IS 'Subscription status (active, unsubscribed, inactive)';
COMMENT ON COLUMN profiles.bounce_reason IS 'Reason email bounced (if any)';

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);

-- Update existing profiles to have default values
UPDATE profiles 
SET 
    subscription_tier = COALESCE(subscription_tier, 'free'),
    status = COALESCE(status, 'active')
WHERE subscription_tier IS NULL OR status IS NULL;

-- Rollback migration (commented out - uncomment if rollback needed)
-- ALTER TABLE profiles
--   DROP COLUMN IF EXISTS bounce_reason,
--   DROP COLUMN IF EXISTS status,
--   DROP COLUMN IF EXISTS subscription_tier;