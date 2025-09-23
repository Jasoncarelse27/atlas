-- Stores uploaded attachments so Atlas Brain can process them
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  conversation_id uuid, -- optional if you track conversations
  feature text check (feature in ('image','camera','audio','file')) not null,
  url text not null,
  content_type text,
  size_bytes bigint,
  created_at timestamptz default now()
);

alter table attachments enable row level security;

-- Let authenticated users read their own attachments (adjust as needed)
create policy "read own attachments"
on attachments for select
using (auth.uid() = user_id);

-- Service role can do everything
create policy "service can do all"
on attachments for all
using (true);
