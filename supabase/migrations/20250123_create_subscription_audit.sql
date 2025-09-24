-- Migration: Create subscription_audit table for tracking subscription changes
-- This table will track all subscription tier changes for analytics

create table if not exists subscription_audit (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references profiles(id) on delete cascade,
  event_type text not null check (event_type in ('subscription.activated', 'subscription.canceled', 'subscription.updated')),
  old_tier text check (old_tier in ('free', 'core', 'studio')),
  new_tier text check (new_tier in ('free', 'core', 'studio')),
  provider text default 'fastspring', -- 'fastspring', 'paddle', 'manual'
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Add indexes for performance
create index if not exists idx_subscription_audit_profile_id on subscription_audit(profile_id);
create index if not exists idx_subscription_audit_event_type on subscription_audit(event_type);
create index if not exists idx_subscription_audit_created_at on subscription_audit(created_at);
create index if not exists idx_subscription_audit_tiers on subscription_audit(old_tier, new_tier);

-- Add RLS policies
alter table subscription_audit enable row level security;

-- Service role can do everything (for webhooks and admin)
create policy "Service role full access" on subscription_audit
  for all using (auth.role() = 'service_role');

-- Users can read their own audit history
create policy "Users can read own audit history" on subscription_audit
  for select using (auth.uid() = profile_id);

-- Function to log subscription changes
create or replace function log_subscription_change(
  p_profile_id uuid,
  p_event_type text,
  p_old_tier text,
  p_new_tier text,
  p_provider text default 'manual',
  p_metadata jsonb default '{}'
)
returns void as $$
begin
  insert into subscription_audit (
    profile_id,
    event_type,
    old_tier,
    new_tier,
    provider,
    metadata
  ) values (
    p_profile_id,
    p_event_type,
    p_old_tier,
    p_new_tier,
    p_provider,
    p_metadata
  );
end;
$$ language plpgsql;

-- Trigger to automatically log subscription changes
create or replace function trigger_log_subscription_change()
returns trigger as $$
begin
  -- Only log if tier actually changed
  if old.subscription_tier is distinct from new.subscription_tier then
    perform log_subscription_change(
      new.id,
      'subscription.updated',
      old.subscription_tier,
      new.subscription_tier,
      'system',
      jsonb_build_object(
        'updated_by', 'system',
        'reason', 'profile_update'
      )
    );
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Create trigger on profiles table
drop trigger if exists trigger_log_subscription_change on profiles;
create trigger trigger_log_subscription_change
  after update of subscription_tier on profiles
  for each row
  execute function trigger_log_subscription_change();

-- Insert some sample data for testing
insert into subscription_audit (profile_id, event_type, old_tier, new_tier, provider, metadata)
select 
  id,
  'subscription.activated',
  'free',
  subscription_tier,
  'system',
  jsonb_build_object('initial_setup', true)
from profiles
where subscription_tier != 'free'
on conflict do nothing;
