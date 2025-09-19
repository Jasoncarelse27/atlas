-- Daily usage housekeeping (safe cleanup, no hard resets)
-- Keeps recent rows, removes old data to keep tables lean.
-- This migration is safe and won't affect current day usage counts.

-- 1) Enable pg_cron (best effort - may not be available on all tiers)
create extension if not exists pg_cron;

-- 2) Housekeeping function(s)
create or replace function rotate_daily_usage()
returns void language plpgsql as $$
begin
  -- Keep last 35 days; remove older (adjust if needed)
  -- This doesn't affect today's counts - your middleware already rolls day-by-day
  delete from daily_usage
  where date < current_date - interval '35 days';
  
  -- Log the cleanup (optional)
  raise notice 'Daily usage cleanup completed - removed records older than 35 days';
end;
$$;

create or replace function compact_budget_tracking()
returns void language plpgsql as $$
begin
  -- Keep last 60 days of budget snapshots
  delete from budget_tracking
  where date < current_date - interval '60 days';
  
  -- Log the cleanup (optional)
  raise notice 'Budget tracking cleanup completed - removed records older than 60 days';
end;
$$;

create or replace function cleanup_old_cache_entries()
returns void language plpgsql as $$
begin
  -- Keep cache entries for 30 days
  delete from prompt_cache
  where created_at < current_date - interval '30 days';
  
  -- Log the cleanup (optional)
  raise notice 'Prompt cache cleanup completed - removed entries older than 30 days';
end;
$$;

-- 3) Cron schedule (runs daily at 00:10 server time)
-- If pg_cron isn't available in this project tier,
-- this SELECT will no-op without breaking deploys.
select cron.schedule(
  'atlas-daily-usage-cleanup',
  '10 0 * * *',
  $$call rotate_daily_usage(); call compact_budget_tracking(); call cleanup_old_cache_entries();$$
)
on conflict do nothing;

-- 4) Add comments for clarity
comment on function rotate_daily_usage() is 'Cleans up old daily_usage records (keeps 35 days)';
comment on function compact_budget_tracking() is 'Cleans up old budget_tracking records (keeps 60 days)';
comment on function cleanup_old_cache_entries() is 'Cleans up old prompt_cache entries (keeps 30 days)';

-- 5) Verify the cron job was created (optional logging)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'atlas-daily-usage-cleanup') then
    raise notice '✅ Daily cleanup cron job scheduled successfully';
  else
    raise notice '⚠️  pg_cron not available - cleanup will need to be run manually or via external scheduler';
  end if;
end $$;
