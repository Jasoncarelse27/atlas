-- Fix tier default in user_profiles table
-- Copy this SQL and run it in your Supabase SQL Editor

-- Ensure tier column has proper default
ALTER TABLE public.user_profiles 
ALTER COLUMN subscription_tier SET DEFAULT 'free';

-- Update any existing rows that might have NULL tier
UPDATE public.user_profiles 
SET subscription_tier = 'free' 
WHERE subscription_tier IS NULL;

-- Verify the fix
SELECT id, email, subscription_tier, created_at 
FROM public.user_profiles 
ORDER BY created_at DESC 
LIMIT 10;
