-- Rollback: 20250914_add_subscription_columns.sql
-- Remove subscription columns from user_profiles

ALTER TABLE user_profiles 
DROP COLUMN IF EXISTS subscription_id,
DROP COLUMN IF EXISTS subscription_status,
DROP COLUMN IF EXISTS tier;
