-- ============================================
-- Atlas AI - Image Events Table
-- Mirrors audio_events for consistency
-- ============================================

create table if not exists public.image_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in (
    'image_upload_start',
    'image_upload_complete',
    'image_upload_fail',
    'image_scan_request',
    'image_scan_success',
    'image_scan_fail'
  )),
  file_path text,
  file_size bigint,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS: only user can see their own image events
alter table public.image_events enable row level security;

create policy "Users can insert own image events"
  on public.image_events
  for insert
  with check (auth.uid() = user_id);

create policy "Users can view own image events"
  on public.image_events
  for select
  using (auth.uid() = user_id);

-- Create secure storage bucket for images if it doesn't exist
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

-- RLS: Only the uploading user can access their files
create policy "Users can upload their own images"
  on storage.objects
  for insert
  with check (bucket_id = 'uploads' and auth.uid() = owner);

create policy "Users can view their own images"
  on storage.objects
  for select
  using (bucket_id = 'uploads' and auth.uid() = owner);

create policy "Users can delete their own images"
  on storage.objects
  for delete
  using (bucket_id = 'uploads' and auth.uid() = owner);
