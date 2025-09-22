-- Migration: Paddle subscriptions (mock + future-proof)
-- Drop old view if exists
drop view if exists paddle_subscriptions;

-- Create the table
create table if not exists paddle_subscriptions (
  id uuid references profiles(id) on delete cascade, -- user_id
  price_id text,
  status text check (status in ('free', 'active', 'canceled', 'past_due')),
  subscription_tier text check (subscription_tier in ('free', 'core', 'studio')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id)
);

-- Seed from profiles (mock mode)
insert into paddle_subscriptions (id, status, subscription_tier, created_at, updated_at)
select
  id,
  case when subscription_tier = 'free' then 'free' else 'active' end,
  subscription_tier,
  created_at,
  updated_at
from profiles
on conflict (id) do update
set status = excluded.status,
    subscription_tier = excluded.subscription_tier,
    updated_at = now();

-- Trigger to sync on profile updates
create or replace function sync_paddle_subscriptions()
returns trigger as $$
begin
  insert into paddle_subscriptions (id, status, subscription_tier, created_at, updated_at)
  values (
    new.id,
    case when new.subscription_tier = 'free' then 'free' else 'active' end,
    new.subscription_tier,
    new.created_at,
    now()
  )
  on conflict (id) do update
  set status = excluded.status,
      subscription_tier = excluded.subscription_tier,
      updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_sync_paddle_subscriptions on profiles;
create trigger trigger_sync_paddle_subscriptions
after insert or update of subscription_tier on profiles
for each row
execute function sync_paddle_subscriptions();

-- Add RLS policies
alter table paddle_subscriptions enable row level security;

-- Users can read their own subscription
create policy "Users can read own subscription" on paddle_subscriptions
  for select using (auth.uid() = id);

-- Users can update their own subscription
create policy "Users can update own subscription" on paddle_subscriptions
  for update using (auth.uid() = id);

-- Service role can do everything (for webhooks)
create policy "Service role full access" on paddle_subscriptions
  for all using (auth.role() = 'service_role');
