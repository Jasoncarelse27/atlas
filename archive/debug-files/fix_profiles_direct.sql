-- ============================
-- Atlas Profiles Setup (Direct Fix)
-- ============================

-- 1. Ensure profiles.id references auth.users.id
alter table profiles
  drop constraint if exists profiles_id_fkey;

alter table profiles
  add constraint profiles_id_fkey
  foreign key (id)
  references auth.users (id)
  on delete cascade;

-- 2. Auto-create profile when a new user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, subscription_tier, subscription_status)
  values (new.id, new.email, 'free', 'active')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure handle_new_user();

-- 3. Enable Row Level Security (RLS) for safety
alter table profiles enable row level security;

-- 4. Allow users to view their own profile (drop if exists first)
drop policy if exists "Users can view their own profile" on profiles;
create policy "Users can view their own profile"
on profiles for select
using (auth.uid() = id);

-- 5. Allow users to update their own profile (drop if exists first)
drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile"
on profiles for update
using (auth.uid() = id);