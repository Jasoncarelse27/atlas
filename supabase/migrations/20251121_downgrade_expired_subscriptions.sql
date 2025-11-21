-- Migration: Downgrade expired subscriptions (cancelled and grace period)
-- Automatically downgrades users when their subscription period ends or grace period expires
-- Runs daily via pg_cron

-- 1. Function to downgrade expired cancelled subscriptions
-- Users who cancelled but period hasn't ended yet keep their tier
-- Once period ends, downgrade to 'free'
create or replace function downgrade_expired_cancelled_subscriptions()
returns integer
language plpgsql
security definer
as $$
declare
  downgraded_count integer;
begin
  -- Update profiles: downgrade users whose cancelled subscription period has ended
  with expired_cancelled as (
    select distinct user_id
    from fastspring_subscriptions
    where status = 'cancelled'
      and cancel_at_period_end = true
      and current_period_end is not null
      and current_period_end < now()
  )
  update profiles
  set 
    subscription_tier = 'free',
    subscription_status = 'cancelled',
    subscription_id = null,
    updated_at = now()
  where id in (select user_id from expired_cancelled)
    and subscription_tier != 'free'; -- Only update if not already free
  
  get diagnostics downgraded_count = row_count;
  
  -- Update subscription status to 'unpaid' for expired cancelled subscriptions
  update fastspring_subscriptions
  set 
    status = 'unpaid',
    cancel_at_period_end = false,
    updated_at = now()
  where status = 'cancelled'
    and cancel_at_period_end = true
    and current_period_end is not null
    and current_period_end < now();
  
  return downgraded_count;
end;
$$;

-- 2. Function to downgrade expired grace periods
-- Users with failed payments get 24-hour grace period
-- After grace period expires, downgrade to 'free'
create or replace function downgrade_expired_grace_periods()
returns integer
language plpgsql
security definer
as $$
declare
  downgraded_count integer;
begin
  -- Update profiles: downgrade users whose grace period has expired
  with expired_grace as (
    select distinct user_id
    from fastspring_subscriptions
    where status = 'past_due'
      and grace_period_end is not null
      and grace_period_end < now()
  )
  update profiles
  set 
    subscription_tier = 'free',
    subscription_status = 'inactive',
    subscription_id = null,
    updated_at = now()
  where id in (select user_id from expired_grace)
    and subscription_tier != 'free'; -- Only update if not already free
  
  get diagnostics downgraded_count = row_count;
  
  -- Update subscription status to 'unpaid' for expired grace periods
  update fastspring_subscriptions
  set 
    status = 'unpaid',
    grace_period_end = null,
    updated_at = now()
  where status = 'past_due'
    and grace_period_end is not null
    and grace_period_end < now();
  
  return downgraded_count;
end;
$$;

-- 3. Combined function that runs both checks
-- This is what the cron job will call
create or replace function process_expired_subscriptions()
returns json
language plpgsql
security definer
as $$
declare
  cancelled_count integer;
  grace_period_count integer;
begin
  -- Downgrade expired cancelled subscriptions
  select downgrade_expired_cancelled_subscriptions() into cancelled_count;
  
  -- Downgrade expired grace periods
  select downgrade_expired_grace_periods() into grace_period_count;
  
  -- Return summary
  return json_build_object(
    'cancelled_downgraded', cancelled_count,
    'grace_period_downgraded', grace_period_count,
    'timestamp', now()
  );
end;
$$;

-- 4. Schedule daily job (runs every day at 03:00 UTC)
-- Checks for expired subscriptions and downgrades users automatically
-- Note: If job already exists, unschedule it first or this will error
-- To update: SELECT cron.unschedule('downgrade-expired-subscriptions'); then re-run this
SELECT cron.schedule(
  'downgrade-expired-subscriptions',
  '0 3 * * *', -- Daily at 3 AM UTC
  $$SELECT process_expired_subscriptions();$$
);

-- 5. Add comments for documentation
comment on function downgrade_expired_cancelled_subscriptions() is 'Downgrades users whose cancelled subscription period has ended';
comment on function downgrade_expired_grace_periods() is 'Downgrades users whose 24-hour grace period has expired';
comment on function process_expired_subscriptions() is 'Main function that processes all expired subscriptions (cancelled and grace period)';

-- 6. Verify the cron job was created
do $$
begin
  if exists (select 1 from cron.job where jobname = 'downgrade-expired-subscriptions') then
    raise notice '✅ Expired subscription downgrade cron job scheduled successfully (runs daily at 03:00 UTC)';
  else
    raise notice '⚠️  pg_cron not available - downgrade will need to be run manually or via external scheduler';
  end if;
end $$;

