-- Add preferences column to profiles table for user questionnaire data
-- Safe migration: nullable column, backwards compatible

-- Add preferences jsonb column if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.preferences IS 'User questionnaire preferences: workFunction, goals, communicationStyle';

-- No RLS changes needed - users can already update their own profiles
-- No index needed - preferences is queried by user_id (already indexed)

