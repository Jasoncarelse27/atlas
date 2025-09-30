-- Rollback for Atlas Usage Management System

-- Drop functions
drop function if exists cleanup_expired_cache();
drop function if exists get_or_create_daily_usage(uuid, text, date);
drop function if exists increment_conversation_count(uuid, text, integer, decimal);
drop function if exists update_updated_at_column();

-- Drop triggers
drop trigger if exists update_daily_usage_updated_at on daily_usage;

-- Drop tables (in reverse order of dependencies)
drop table if exists response_cache;
drop table if exists error_logs;
drop table if exists usage_logs;
drop table if exists daily_usage;
