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

-- 2. Auto-update updated_at
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

-- 3. Self-healing function to create profiles for any users without one
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

-- 4. Schedule daily job (runs every night at 02:00 UTC)
-- This requires Supabase pgcron extension (enabled by default on paid projects)
select cron.schedule(
  'self-heal-profiles',
  '0 2 * * *',
  $$ call ensure_all_profiles(); $$
);
