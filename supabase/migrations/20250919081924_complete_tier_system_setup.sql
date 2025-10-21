-- ============================
-- Atlas Complete Tier System Setup Migration
-- Consolidating all pending tier system, subscription, and usage tracking changes
-- ============================

-- 1. PADDLE SUBSCRIPTION MANAGEMENT SCHEMA
-- ==========================================

-- Paddle subscriptions table
create table if not exists paddle_subscriptions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  paddle_subscription_id text not null unique,
  paddle_plan_id text not null,
  tier text not null check (tier in ('free', 'core', 'studio')),
  status text not null check (status in ('active', 'trialing', 'past_due', 'cancelled', 'unpaid')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean default false,
  grace_period_end timestamptz, -- 7-day grace period for failed payments
  paddle_checkout_id text,
  paddle_user_id text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Paddle webhook events log
create table if not exists paddle_webhook_events (
  id bigserial primary key,
  alert_id text not null unique,
  alert_name text not null,
  subscription_id text,
  user_id uuid references auth.users(id) on delete set null,
  event_data jsonb not null,
  processed boolean default false,
  processing_error text,
  created_at timestamptz default now() not null
);

-- Usage reconciliation log for billing
create table if not exists usage_reconciliation (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id bigint references paddle_subscriptions(id) on delete cascade,
  date date not null,
  tier text not null,
  conversations_attempted integer default 0,
  conversations_allowed integer default 0,
  conversations_blocked integer default 0,
  tokens_used integer default 0,
  api_cost_estimate decimal(10,4) default 0,
  crisis_bypass_count integer default 0, -- Ethical safeguard usage
  created_at timestamptz default now() not null,
  
  unique(user_id, date)
);

-- 2. USAGE TRACKING SYSTEM
-- =========================

-- Daily usage tracking table
create table if not exists daily_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  conversations_count integer default 0 not null,
  total_tokens_used integer default 0 not null,
  api_cost_estimate decimal(10,4) default 0 not null,
  tier text not null check (tier in ('free', 'core', 'studio')),
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
  tier text not null check (tier in ('free', 'core', 'studio')),
  hit_count integer default 1 not null,
  created_at timestamptz default now() not null,
  expires_at timestamptz not null
);

-- 3. ENHANCED TIER GATE SYSTEM
-- =============================

-- Prompt Cache (for caching system prompts - 90% cost reduction)
create table if not exists prompt_cache (
  id bigserial primary key,
  hash text not null unique,
  content text not null,
  tokens integer not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

-- Model Usage Logs (for intelligent model selection analytics)
create table if not exists model_usage_logs (
  id bigserial primary key,
  date date not null,
  model text not null,
  tier text not null check (tier in ('free', 'core', 'studio')),
  count integer default 1,
  cost_estimate numeric(10,4) default 0,
  created_at timestamptz default now(),
  unique(date, model, tier)
);

-- Cache Stats (for tracking cache efficiency)
create table if not exists cache_stats (
  id bigserial primary key,
  date date not null unique,
  hits integer default 0,
  misses integer default 0,
  cost_savings numeric(10,4) default 0,
  created_at timestamptz default now()
);

-- Budget Tracking (for daily ceiling enforcement)
create table if not exists budget_tracking (
  id bigserial primary key,
  date date not null,
  tier text not null check (tier in ('free', 'core', 'studio')),
  total_spend numeric(10,4) default 0,
  request_count integer default 0,
  last_updated timestamptz default now(),
  unique(date, tier)
);

-- 4. INDEXES FOR PERFORMANCE
-- ===========================

-- Paddle subscriptions indexes
create index if not exists idx_paddle_subscriptions_user_id on paddle_subscriptions(user_id);
create index if not exists idx_paddle_subscriptions_status on paddle_subscriptions(status);
create index if not exists idx_paddle_subscriptions_tier on paddle_subscriptions(tier);
create index if not exists idx_paddle_subscriptions_period_end on paddle_subscriptions(current_period_end);

-- Ensure one active subscription per user (partial unique index)
create unique index if not exists idx_paddle_subscriptions_user_active 
  on paddle_subscriptions(user_id) where status = 'active';
create index if not exists idx_paddle_webhook_events_alert_id on paddle_webhook_events(alert_id);
create index if not exists idx_paddle_webhook_events_processed on paddle_webhook_events(processed);
create index if not exists idx_usage_reconciliation_user_date on usage_reconciliation(user_id, date);
create index if not exists idx_usage_reconciliation_date on usage_reconciliation(date);

-- Usage tracking indexes
create index if not exists idx_daily_usage_user_date on daily_usage(user_id, date);
create index if not exists idx_daily_usage_date on daily_usage(date);
create index if not exists idx_usage_logs_timestamp on usage_logs(timestamp);
create index if not exists idx_usage_logs_user_event on usage_logs(user_id, event);
create index if not exists idx_error_logs_timestamp on error_logs(timestamp);
create index if not exists idx_response_cache_expires on response_cache(expires_at);
create index if not exists idx_response_cache_tier on response_cache(tier);

-- Tier gate system indexes
create index if not exists idx_prompt_cache_expires on prompt_cache(expires_at);
create index if not exists idx_prompt_cache_hash on prompt_cache(hash);
create index if not exists idx_model_usage_date on model_usage_logs(date);
create index if not exists idx_model_usage_model on model_usage_logs(model);
create index if not exists idx_model_usage_tier on model_usage_logs(tier);
create index if not exists idx_cache_stats_date on cache_stats(date);
create index if not exists idx_budget_tracking_date_tier on budget_tracking(date, tier);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================

-- Enable RLS on all tables
alter table paddle_subscriptions enable row level security;
alter table paddle_webhook_events enable row level security;
alter table usage_reconciliation enable row level security;
alter table daily_usage enable row level security;
alter table usage_logs enable row level security;
alter table error_logs enable row level security;
alter table response_cache enable row level security;
alter table prompt_cache enable row level security;
alter table model_usage_logs enable row level security;
alter table cache_stats enable row level security;
alter table budget_tracking enable row level security;

-- Subscription policies
create policy "Users can view own subscriptions"
  on paddle_subscriptions for select
  using (auth.uid() = user_id);

create policy "Service role can manage subscriptions"
  on paddle_subscriptions for all
  using (auth.role() = 'service_role');

-- Webhook events - service role only
create policy "Service role can manage webhook events"
  on paddle_webhook_events for all
  using (auth.role() = 'service_role');

-- Usage reconciliation policies
create policy "Users can view own usage reconciliation"
  on usage_reconciliation for select
  using (auth.uid() = user_id);

create policy "Service role can manage usage reconciliation"
  on usage_reconciliation for all
  using (auth.role() = 'service_role');

-- Daily usage policies
create policy "Users can view own daily usage"
  on daily_usage for select
  using (auth.uid() = user_id);

create policy "Users can insert own daily usage"
  on daily_usage for insert
  with check (auth.uid() = user_id);

create policy "Users can update own daily usage"
  on daily_usage for update
  using (auth.uid() = user_id);

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

-- Tier gate system policies - service role only (handle existing policies)
do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'prompt_cache' and policyname = 'srv role manage prompt_cache') then
    execute 'create policy "srv role manage prompt_cache" on prompt_cache for all using (auth.role() = ''service_role'')';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'model_usage_logs' and policyname = 'srv role manage model_usage') then
    execute 'create policy "srv role manage model_usage" on model_usage_logs for all using (auth.role() = ''service_role'')';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'cache_stats' and policyname = 'srv role manage cache_stats') then
    execute 'create policy "srv role manage cache_stats" on cache_stats for all using (auth.role() = ''service_role'')';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'budget_tracking' and policyname = 'srv role manage budget') then
    execute 'create policy "srv role manage budget" on budget_tracking for all using (auth.role() = ''service_role'')';
  end if;
end $$;

-- 6. VIEWS AND ANALYTICS
-- =======================

-- Subscription analytics view
create or replace view subscription_analytics as
select 
  tier,
  status,
  count(*) as subscription_count,
  sum(case when status = 'active' then 
    case 
      when tier = 'core' then 19.99
      when tier = 'studio' then 189.99
      else 0
    end
  else 0 end) as monthly_revenue,
  avg(extract(epoch from (current_period_end - current_period_start)) / 86400) as avg_subscription_length_days
from paddle_subscriptions
group by tier, status;

-- 7. FUNCTIONS
-- =============

-- Subscription management functions
create or replace function get_user_current_subscription(p_user_id uuid)
returns paddle_subscriptions
language plpgsql
security definer
as $$
declare
  subscription_record paddle_subscriptions;
begin
  -- Get active subscription or most recent if none active
  select * into subscription_record
  from paddle_subscriptions
  where user_id = p_user_id
    and (status = 'active' or (status = 'past_due' and grace_period_end > now()))
  order by 
    case when status = 'active' then 1 else 2 end,
    created_at desc
  limit 1;
  
  -- If no active/grace period subscription, return most recent
  if not found then
    select * into subscription_record
    from paddle_subscriptions
    where user_id = p_user_id
    order by created_at desc
    limit 1;
  end if;
  
  return subscription_record;
end;
$$;

-- Grace period check function
create or replace function is_user_in_grace_period(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  grace_end timestamptz;
begin
  select grace_period_end into grace_end
  from paddle_subscriptions
  where user_id = p_user_id
    and status = 'past_due'
    and grace_period_end > now()
  limit 1;
  
  return found;
end;
$$;

-- Usage tracking functions
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

-- Conversation count increment
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

-- Usage attempt logging for reconciliation
create or replace function log_usage_attempt(
  p_user_id uuid,
  p_tier text,
  p_attempted boolean,
  p_allowed boolean,
  p_tokens_used integer default 0,
  p_api_cost decimal default 0,
  p_crisis_bypass boolean default false
)
returns void
language plpgsql
security definer
as $$
declare
  today_date date := current_date;
  subscription_record paddle_subscriptions;
begin
  -- Get current subscription
  select * into subscription_record
  from get_user_current_subscription(p_user_id);
  
  -- Insert or update usage reconciliation record
  insert into usage_reconciliation (
    user_id,
    subscription_id,
    date,
    tier,
    conversations_attempted,
    conversations_allowed,
    conversations_blocked,
    tokens_used,
    api_cost_estimate,
    crisis_bypass_count
  )
  values (
    p_user_id,
    subscription_record.id,
    today_date,
    p_tier,
    case when p_attempted then 1 else 0 end,
    case when p_allowed then 1 else 0 end,
    case when p_attempted and not p_allowed then 1 else 0 end,
    p_tokens_used,
    p_api_cost,
    case when p_crisis_bypass then 1 else 0 end
  )
  on conflict (user_id, date)
  do update set
    conversations_attempted = usage_reconciliation.conversations_attempted + excluded.conversations_attempted,
    conversations_allowed = usage_reconciliation.conversations_allowed + excluded.conversations_allowed,
    conversations_blocked = usage_reconciliation.conversations_blocked + excluded.conversations_blocked,
    tokens_used = usage_reconciliation.tokens_used + excluded.tokens_used,
    api_cost_estimate = usage_reconciliation.api_cost_estimate + excluded.api_cost_estimate,
    crisis_bypass_count = usage_reconciliation.crisis_bypass_count + excluded.crisis_bypass_count;
end;
$$;

-- Tier gate system functions
create or replace function log_model_usage(p_date date, p_model text, p_tier text, p_cost numeric)
returns void language plpgsql security definer as $$
begin
  insert into model_usage_logs(date, model, tier, count, cost_estimate)
  values (p_date, p_model, p_tier, 1, p_cost)
  on conflict (date, model, tier) do update
  set count = model_usage_logs.count + 1,
      cost_estimate = model_usage_logs.cost_estimate + excluded.cost_estimate;
end; $$;

create or replace function update_cache_stats(p_date date, p_hit boolean, p_cost_savings numeric default 0)
returns void language plpgsql security definer as $$
begin
  insert into cache_stats(date, hits, misses, cost_savings)
  values (p_date, case when p_hit then 1 else 0 end, case when p_hit then 0 else 1 end, p_cost_savings)
  on conflict (date) do update
  set hits = cache_stats.hits + (case when p_hit then 1 else 0 end),
      misses = cache_stats.misses + (case when p_hit then 0 else 1 end),
      cost_savings = cache_stats.cost_savings + p_cost_savings;
end; $$;

create or replace function increment_budget_tracking(p_date date, p_tier text, p_spend_delta numeric, p_req_delta integer default 1)
returns void language plpgsql security definer as $$
begin
  insert into budget_tracking(date, tier, total_spend, request_count)
  values (p_date, p_tier, coalesce(p_spend_delta,0), coalesce(p_req_delta,1))
  on conflict (date, tier) do update
  set total_spend = budget_tracking.total_spend + coalesce(p_spend_delta,0),
      request_count = budget_tracking.request_count + coalesce(p_req_delta,1),
      last_updated = now();
end; $$;

-- Cleanup functions
create or replace function cleanup_expired_cache()
returns void
language plpgsql
security definer
as $$
begin
  delete from response_cache where expires_at < now();
  delete from prompt_cache where expires_at < now();
end;
$$;

create or replace function cleanup_expired_grace_periods()
returns integer
language plpgsql
security definer
as $$
declare
  updated_count integer;
begin
  update paddle_subscriptions
  set 
    status = 'unpaid',
    grace_period_end = null,
    updated_at = now()
  where status = 'past_due'
    and grace_period_end < now();
    
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

-- 8. TRIGGERS
-- ===========

-- Update timestamp triggers
create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function update_subscription_updated_at()
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

create trigger update_paddle_subscriptions_updated_at
  before update on paddle_subscriptions
  for each row
  execute function update_subscription_updated_at();

-- 9. PERMISSIONS
-- ===============

-- Grant basic schema usage
grant usage on schema public to anon, authenticated;

-- Subscription permissions
grant select on paddle_subscriptions to authenticated;
grant select on usage_reconciliation to authenticated;
grant select on subscription_analytics to authenticated;
grant execute on function get_user_current_subscription(uuid) to authenticated;
grant execute on function is_user_in_grace_period(uuid) to authenticated;
grant execute on function log_usage_attempt(uuid, text, boolean, boolean, integer, decimal, boolean) to authenticated;

-- Usage tracking permissions
grant select, insert, update on daily_usage to authenticated;
grant select on response_cache to anon, authenticated;
grant execute on function get_or_create_daily_usage(uuid, text, date) to authenticated;
grant execute on function increment_conversation_count(uuid, text, integer, decimal) to authenticated;

-- Tier gate system permissions
grant execute on function log_model_usage(date,text,text,numeric) to authenticated;
grant execute on function update_cache_stats(date,boolean,numeric) to authenticated;
grant execute on function increment_budget_tracking(date,text,numeric,integer) to authenticated;

-- ============================
-- Atlas Complete Tier System Setup Complete!
-- ============================
