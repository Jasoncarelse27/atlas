-- ============================================
-- Atlas AI - Fix Image Migration (Handle Existing Policies)
-- ============================================

-- Drop existing policies if they exist to avoid conflicts
drop policy if exists "Users can insert own image events" on public.image_events;
drop policy if exists "Users can view own image events" on public.image_events;

-- Create image events table (if not exists)
create table if not exists public.image_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in (
    'image_upload_start',
    'image_upload_complete',
    'image_upload_fail',
    'image_scan_request',
    'image_scan_success',
    'image_scan_fail',
    'upgrade_prompt_shown'
  )),
  file_path text,
  file_size bigint,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table public.image_events enable row level security;

-- Create fresh policies
create policy "Users can insert own image events"
  on public.image_events
  for insert
  with check (auth.uid() = user_id);

create policy "Users can view own image events"
  on public.image_events
  for select
  using (auth.uid() = user_id);

-- Create upgrade stats table (if not exists)
create table if not exists upgrade_stats (
  feature text not null primary key,
  total_prompts int not null default 0,
  unique_users int not null default 0,
  updated_at timestamp with time zone default now()
);

-- Drop and recreate trigger function to avoid conflicts
drop trigger if exists trg_upgrade_stats on image_events;
drop function if exists update_upgrade_stats();

create or replace function update_upgrade_stats()
returns trigger
language plpgsql
as $$
begin
  if NEW.event_name = 'upgrade_prompt_shown' then
    insert into upgrade_stats (feature, total_prompts, unique_users, updated_at)
    values (
      NEW.metadata->>'feature',
      1,
      1,
      now()
    )
    on conflict (feature)
    do update
      set total_prompts = upgrade_stats.total_prompts + 1,
          unique_users = (
            select count(distinct user_id)
            from image_events
            where event_name = 'upgrade_prompt_shown'
              and metadata->>'feature' = NEW.metadata->>'feature'
          ),
          updated_at = now();
  end if;

  return NEW;
end;
$$;

-- Create trigger
create trigger trg_upgrade_stats
after insert on image_events
for each row
execute function update_upgrade_stats();

-- Create storage bucket (if not exists)
insert into storage.buckets (id, name, public)
values ('images', 'images', false)
on conflict (id) do nothing;

-- Drop existing storage policies to avoid conflicts
drop policy if exists "Users can upload their own images" on storage.objects;
drop policy if exists "Users can view their own images" on storage.objects;
drop policy if exists "Users can delete their own images" on storage.objects;

-- Create fresh storage policies
create policy "Users can upload their own images"
  on storage.objects
  for insert
  with check (bucket_id = 'images' and auth.uid() = owner);

create policy "Users can view their own images"
  on storage.objects
  for select
  using (bucket_id = 'images' and auth.uid() = owner);

create policy "Users can delete their own images"
  on storage.objects
  for delete
  using (bucket_id = 'images' and auth.uid() = owner);
