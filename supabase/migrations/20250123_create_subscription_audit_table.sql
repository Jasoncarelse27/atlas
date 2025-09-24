-- Migration: Create subscription_audit table for FastSpring webhook integration
-- This table tracks all subscription changes for analytics and audit purposes

create table if not exists public.subscription_audit (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade,
    event_type text check (event_type in ('activation', 'cancellation', 'upgrade', 'downgrade')),
    old_tier text,
    new_tier text not null,
    source text default 'fastspring',
    created_at timestamptz default now()
);

-- Add indexes for performance
create index if not exists subscription_audit_user_idx on public.subscription_audit(user_id);
create index if not exists subscription_audit_event_idx on public.subscription_audit(event_type);
create index if not exists subscription_audit_created_at_idx on public.subscription_audit(created_at);

-- Add RLS policies
alter table public.subscription_audit enable row level security;

-- Service role can do everything (for webhooks)
create policy "Service role full access" on public.subscription_audit
  for all using (auth.role() = 'service_role');

-- Users can read their own audit history
create policy "Users can read own audit history" on public.subscription_audit
  for select using (auth.uid() = user_id);

-- Function to log subscription changes
create or replace function log_subscription_change(
  p_user_id uuid,
  p_event_type text,
  p_old_tier text,
  p_new_tier text,
  p_source text default 'fastspring'
)
returns void as $$
begin
  insert into subscription_audit (
    user_id,
    event_type,
    old_tier,
    new_tier,
    source
  ) values (
    p_user_id,
    p_event_type,
    p_old_tier,
    p_new_tier,
    p_source
  );
end;
$$ language plpgsql;
