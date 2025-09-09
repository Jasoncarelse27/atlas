create table if not exists public.eq_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  conversation_id uuid,
  role text check (role in ('user','atlas')) not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_eq_messages_user_time on public.eq_messages(user_id, created_at);
