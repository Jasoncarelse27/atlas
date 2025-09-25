-- Ensure column exists
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_tier TEXT;

-- Set default to 'free'
ALTER TABLE profiles
ALTER COLUMN subscription_tier SET DEFAULT 'free';

-- Backfill NULL values
UPDATE profiles
SET subscription_tier = 'free'
WHERE subscription_tier IS NULL;

-- Enforce valid values
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS subscription_tier_valid;
ALTER TABLE profiles
ADD CONSTRAINT subscription_tier_valid
CHECK (subscription_tier IN ('free', 'core', 'studio'));
