-- Atlas Storage Implementation
-- Creates conversations and messages tables for persistent storage

-- 1. Conversations table
create table if not exists conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  title text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Messages table
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create indexes for performance
create index if not exists idx_messages_conversation_id on messages (conversation_id);
create index if not exists idx_messages_user_id on messages (user_id);
create index if not exists idx_conversations_user_id on conversations (user_id);

-- Enable RLS (Row Level Security)
alter table conversations enable row level security;
alter table messages enable row level security;

-- RLS Policies for conversations
create policy "Users can view their own conversations"
  on conversations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own conversations"
  on conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own conversations"
  on conversations for update
  using (auth.uid() = user_id);

create policy "Users can delete their own conversations"
  on conversations for delete
  using (auth.uid() = user_id);

-- RLS Policies for messages
create policy "Users can view messages in their conversations"
  on messages for select
  using (auth.uid() = user_id);

create policy "Users can insert messages in their conversations"
  on messages for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own messages"
  on messages for update
  using (auth.uid() = user_id);

create policy "Users can delete their own messages"
  on messages for delete
  using (auth.uid() = user_id);
