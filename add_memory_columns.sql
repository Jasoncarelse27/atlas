-- Add memory columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_context JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS personal_details JSONB DEFAULT '{}';

-- Verify the columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('user_context', 'personal_details');
