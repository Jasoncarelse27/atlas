-- ==========================================================
-- Atlas Tutorial Completion Migration
-- ==========================================================
-- Purpose: Add tutorial_completed_at column to profiles table
-- Following Atlas best practices: idempotent, safe, no data loss
-- 
-- Safety: Fully idempotent - safe to run multiple times
-- ==========================================================

-- Step 1: Add tutorial_completed_at column if it doesn't exist
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS tutorial_completed_at timestamptz;

-- Step 2: Add index for performance (only if column exists)
-- This index helps with quick lookups for first-time user detection
CREATE INDEX IF NOT EXISTS idx_profiles_tutorial_completed 
  ON profiles(tutorial_completed_at) 
  WHERE tutorial_completed_at IS NOT NULL;

-- Step 3: Add column documentation
COMMENT ON COLUMN profiles.tutorial_completed_at IS 
  'Timestamp when user completed the first-time tutorial. NULL means tutorial not completed yet.';

-- ✅ Migration complete - tutorial completion tracking ready
-- Existing users will have NULL (tutorial not completed)
-- New users will have NULL until they complete tutorial

