-- Rollback for Paddle Subscription Management Schema

-- Drop functions
drop function if exists cleanup_expired_grace_periods();
drop function if exists log_usage_attempt(uuid, text, boolean, boolean, integer, decimal, boolean);
drop function if exists is_user_in_grace_period(uuid);
drop function if exists get_user_current_subscription(uuid);
drop function if exists update_subscription_updated_at();

-- Drop triggers
drop trigger if exists update_paddle_subscriptions_updated_at on paddle_subscriptions;

-- Drop views
drop view if exists subscription_analytics;

-- Drop tables (in reverse order of dependencies)
drop table if exists usage_reconciliation;
drop table if exists paddle_webhook_events;
drop table if exists paddle_subscriptions;
