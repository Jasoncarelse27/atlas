-- Create table for logging feature usage attempts
create table if not exists public.feature_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  feature text not null check (feature in ('mic','image','photo')),
  success boolean not null,
  upgrade_shown boolean not null default false,
  attempted_at timestamptz not null default now()
);

-- Index for faster queries by user
create index if not exists idx_feature_attempts_user
on public.feature_attempts(user_id);

-- Index for reporting by feature
create index if not exists idx_feature_attempts_feature
on public.feature_attempts(feature);

-- Index for ordering by timestamp
create index if not exists idx_feature_attempts_time
on public.feature_attempts(attempted_at desc);

-- Enable RLS
alter table public.feature_attempts enable row level security;

-- Policy: users can insert their own attempts
create policy "Users can insert their own feature attempts"
on public.feature_attempts
for insert
with check (auth.uid() = user_id);

-- Policy: users can read their own attempts
create policy "Users can read their own feature attempts"
on public.feature_attempts
for select
using (auth.uid() = user_id);
