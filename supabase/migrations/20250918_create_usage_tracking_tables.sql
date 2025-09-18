-- Atlas Usage Management System Database Schema
-- Daily conversation tracking, budget protection, and billing analysis

-- Daily usage tracking table
create table if not exists daily_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  conversations_count integer default 0 not null,
  total_tokens_used integer default 0 not null,
  api_cost_estimate decimal(10,4) default 0 not null,
  tier text not null check (tier in ('free', 'basic', 'premium')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  
  -- Ensure one record per user per day
  unique(user_id, date)
);

-- Usage event logs for billing analysis
create table if not exists usage_logs (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  event text not null,
  data jsonb default '{}' not null,
  timestamp timestamptz default now() not null
);

-- Error logs for monitoring
create table if not exists error_logs (
  id bigserial primary key,
  error text not null,
  data jsonb default '{}' not null,
  timestamp timestamptz default now() not null
);

-- Response cache for common emotional intelligence queries
create table if not exists response_cache (
  id bigserial primary key,
  query_hash text not null unique,
  query_text text not null,
  response_text text not null,
  tier text not null check (tier in ('free', 'basic', 'premium')),
  hit_count integer default 1 not null,
  created_at timestamptz default now() not null,
  expires_at timestamptz not null
);

-- Indexes for performance
create index if not exists idx_daily_usage_user_date on daily_usage(user_id, date);
create index if not exists idx_daily_usage_date on daily_usage(date);
create index if not exists idx_usage_logs_timestamp on usage_logs(timestamp);
create index if not exists idx_usage_logs_user_event on usage_logs(user_id, event);
create index if not exists idx_error_logs_timestamp on error_logs(timestamp);
create index if not exists idx_response_cache_expires on response_cache(expires_at);
create index if not exists idx_response_cache_tier on response_cache(tier);

-- RLS Policies
alter table daily_usage enable row level security;
alter table usage_logs enable row level security;
alter table error_logs enable row level security;
alter table response_cache enable row level security;

-- Users can only see their own usage data
create policy "Users can view own daily usage"
  on daily_usage for select
  using (auth.uid() = user_id);

create policy "Users can insert own daily usage"
  on daily_usage for insert
  with check (auth.uid() = user_id);

create policy "Users can update own daily usage"
  on daily_usage for update
  using (auth.uid() = user_id);

-- Service role can manage all usage data
create policy "Service role can manage daily usage"
  on daily_usage for all
  using (auth.role() = 'service_role');

-- Usage logs - service role only (for privacy)
create policy "Service role can manage usage logs"
  on usage_logs for all
  using (auth.role() = 'service_role');

-- Error logs - service role only
create policy "Service role can manage error logs"
  on error_logs for all
  using (auth.role() = 'service_role');

-- Response cache - public read for performance
create policy "Anyone can read response cache"
  on response_cache for select
  to public
  using (true);

create policy "Service role can manage response cache"
  on response_cache for all
  using (auth.role() = 'service_role');

-- Function to clean up expired cache entries
create or replace function cleanup_expired_cache()
returns void
language plpgsql
security definer
as $$
begin
  delete from response_cache where expires_at < now();
end;
$$;

-- Function to get user's daily usage with automatic creation
create or replace function get_or_create_daily_usage(
  p_user_id uuid,
  p_tier text,
  p_date date default current_date
)
returns daily_usage
language plpgsql
security definer
as $$
declare
  usage_record daily_usage;
begin
  -- Try to get existing record
  select * into usage_record
  from daily_usage
  where user_id = p_user_id and date = p_date;
  
  -- Create if doesn't exist
  if not found then
    insert into daily_usage (user_id, date, tier)
    values (p_user_id, p_date, p_tier)
    returning * into usage_record;
  end if;
  
  return usage_record;
end;
$$;

-- Function to safely increment conversation count
create or replace function increment_conversation_count(
  p_user_id uuid,
  p_tier text,
  p_tokens_used integer,
  p_cost_estimate decimal
)
returns daily_usage
language plpgsql
security definer
as $$
declare
  usage_record daily_usage;
begin
  -- Get or create today's record
  select * into usage_record
  from get_or_create_daily_usage(p_user_id, p_tier);
  
  -- Update counts
  update daily_usage
  set 
    conversations_count = conversations_count + 1,
    total_tokens_used = total_tokens_used + p_tokens_used,
    api_cost_estimate = api_cost_estimate + p_cost_estimate,
    updated_at = now()
  where id = usage_record.id
  returning * into usage_record;
  
  return usage_record;
end;
$$;

-- Trigger to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_daily_usage_updated_at
  before update on daily_usage
  for each row
  execute function update_updated_at_column();

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant select, insert, update on daily_usage to authenticated;
grant select on response_cache to anon, authenticated;
grant execute on function get_or_create_daily_usage(uuid, text, date) to authenticated;
grant execute on function increment_conversation_count(uuid, text, integer, decimal) to authenticated;
