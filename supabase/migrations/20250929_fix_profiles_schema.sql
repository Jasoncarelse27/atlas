-- Fix Profiles Table Schema for Atlas Tier System
-- Run this in Supabase SQL Editor or via supabase db push

-- 1. Create profiles table if missing
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  subscription_tier text default 'free' check (subscription_tier in ('free','core','studio')),
  subscription_status text default 'active' check (subscription_status in ('active','inactive','cancelled','trialing')),
  trial_ends_at timestamp with time zone,
  usage_stats jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Ensure defaults + constraints
alter table profiles alter column subscription_tier set default 'free';
alter table profiles alter column subscription_status set default 'active';

-- 3. Update trigger for auto timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp on profiles;
create trigger set_timestamp
before update on profiles
for each row
execute function update_updated_at();