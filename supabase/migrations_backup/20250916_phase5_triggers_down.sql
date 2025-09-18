-- Rollback: 20250916_phase5_triggers.sql
-- Remove phase 5 triggers and functions

-- Drop triggers
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS auto_generate_conversation_title ON conversations;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS generate_conversation_title CASCADE;
