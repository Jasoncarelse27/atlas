-- Add fastspring_account_id column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS fastspring_account_id TEXT;

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_fastspring_account_id 
ON profiles(fastspring_account_id);

-- Add comment for documentation
COMMENT ON COLUMN profiles.fastspring_account_id IS 'FastSpring customer account ID for webhook integration';
