-- ============================
-- Atlas Profiles Self-Healing Migration
-- ============================

-- 1. Ensure profiles table exists (safe sanity check)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  subscription_tier text not null default 'free',
  subscription_status text not null default 'active',
  trial_ends_at timestamptz,
  first_payment timestamptz,
  last_reset_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Ensure missing columns are added safely
alter table profiles add column if not exists subscription_tier text not null default 'free';
alter table profiles add column if not exists subscription_status text not null default 'active';
alter table profiles add column if not exists trial_ends_at timestamptz;
alter table profiles add column if not exists first_payment timestamptz;
alter table profiles add column if not exists last_reset_date timestamptz;

-- 3. Auto-update updated_at
create or replace function update_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on profiles;
create trigger set_profiles_updated_at
before update on profiles
for each row
execute procedure update_profiles_updated_at();

-- 4. Self-healing function to create profiles for any users without one
create or replace function ensure_all_profiles()
returns void as $$
begin
  insert into profiles (id, email, subscription_tier, subscription_status)
  select
    u.id,
    u.email,
    'free',
    'active'
  from auth.users u
  left join profiles p on p.id = u.id
  where p.id is null;
end;
$$ language plpgsql;

-- 5. Run the self-healing function once to fix any missing profiles
select ensure_all_profiles();
