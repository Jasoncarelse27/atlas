-- Rollback: 20241220_tier_enforcement.sql
-- Remove tier enforcement tables and policies

-- Drop policies first
DROP POLICY IF EXISTS "Users can view their own feature attempts" ON feature_attempts;
DROP POLICY IF EXISTS "Users can insert their own feature attempts" ON feature_attempts;

-- Drop tables
DROP TABLE IF EXISTS feature_attempts;
DROP TABLE IF EXISTS feature_flags;

-- Drop any tier enforcement functions
DROP FUNCTION IF EXISTS check_tier_limits CASCADE;
DROP FUNCTION IF EXISTS log_feature_attempt CASCADE;
