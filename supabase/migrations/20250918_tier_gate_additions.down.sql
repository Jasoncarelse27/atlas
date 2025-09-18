-- Rollback for Atlas Enhanced Tier Gate System

-- Drop functions
drop function if exists increment_budget_tracking(date,text,numeric,integer);
drop function if exists update_cache_stats(date,boolean,numeric);
drop function if exists log_model_usage(date,text,text,numeric);

-- Drop tables (in reverse order)
drop table if exists budget_tracking;
drop table if exists cache_stats;
drop table if exists model_usage_logs;
drop table if exists prompt_cache;
