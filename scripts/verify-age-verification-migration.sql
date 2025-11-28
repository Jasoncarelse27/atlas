-- Verification script for age verification migration
-- Run this BEFORE and AFTER the migration to verify it worked

-- BEFORE MIGRATION: Check if columns exist
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' 
  AND column_name IN ('age_verified', 'age_verified_at')
ORDER BY column_name;

-- Check if index exists
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'profiles' 
  AND indexname = 'idx_profiles_age_verified';

-- AFTER MIGRATION: Verify all existing users have FALSE (safe default)
SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE age_verified = FALSE) as unverified_users,
    COUNT(*) FILTER (WHERE age_verified = TRUE) as verified_users
FROM profiles;

