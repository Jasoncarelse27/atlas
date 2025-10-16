-- Atlas Paddle Subscription Management Schema
-- Subscription tracking, payment processing, and grace periods

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
  updated_at timestamptz default now() not null,
  
  -- Ensure one active subscription per user
  unique(user_id, status) where status = 'active'
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

-- Subscription analytics view
create or replace view subscription_analytics as
select 
  tier,
  status,
  count(*) as subscription_count,
  sum(case when status = 'active' then 
    case 
      when tier = 'core' then 19.99
      when tier = 'studio' then 179.99
      else 0
    end
  else 0 end) as monthly_revenue,
  avg(extract(epoch from (current_period_end - current_period_start)) / 86400) as avg_subscription_length_days
from paddle_subscriptions
group by tier, status;

-- Indexes for performance
create index if not exists idx_paddle_subscriptions_user_id on paddle_subscriptions(user_id);
create index if not exists idx_paddle_subscriptions_status on paddle_subscriptions(status);
create index if not exists idx_paddle_subscriptions_tier on paddle_subscriptions(tier);
create index if not exists idx_paddle_subscriptions_period_end on paddle_subscriptions(current_period_end);
create index if not exists idx_paddle_webhook_events_alert_id on paddle_webhook_events(alert_id);
create index if not exists idx_paddle_webhook_events_processed on paddle_webhook_events(processed);
create index if not exists idx_usage_reconciliation_user_date on usage_reconciliation(user_id, date);
create index if not exists idx_usage_reconciliation_date on usage_reconciliation(date);

-- RLS Policies
alter table paddle_subscriptions enable row level security;
alter table paddle_webhook_events enable row level security;
alter table usage_reconciliation enable row level security;

-- Users can only see their own subscriptions
create policy "Users can view own subscriptions"
  on paddle_subscriptions for select
  using (auth.uid() = user_id);

-- Service role can manage all subscription data
create policy "Service role can manage subscriptions"
  on paddle_subscriptions for all
  using (auth.role() = 'service_role');

-- Webhook events - service role only
create policy "Service role can manage webhook events"
  on paddle_webhook_events for all
  using (auth.role() = 'service_role');

-- Usage reconciliation - users can view own data
create policy "Users can view own usage reconciliation"
  on usage_reconciliation for select
  using (auth.uid() = user_id);

create policy "Service role can manage usage reconciliation"
  on usage_reconciliation for all
  using (auth.role() = 'service_role');

-- Functions for subscription management

-- Function to get user's current subscription with caching considerations
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

-- Function to check if user is in grace period
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

-- Function to log usage attempt for reconciliation
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

-- Function to clean up expired grace periods
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

-- Trigger to update updated_at timestamp
create or replace function update_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_paddle_subscriptions_updated_at
  before update on paddle_subscriptions
  for each row
  execute function update_subscription_updated_at();

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant select on paddle_subscriptions to authenticated;
grant select on usage_reconciliation to authenticated;
grant select on subscription_analytics to authenticated;
grant execute on function get_user_current_subscription(uuid) to authenticated;
grant execute on function is_user_in_grace_period(uuid) to authenticated;
grant execute on function log_usage_attempt(uuid, text, boolean, boolean, integer, decimal, boolean) to authenticated;
