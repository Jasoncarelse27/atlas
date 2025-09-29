-- 20250929_fix_conversations_insert_policy.sql
-- Fix RLS insert policy for conversations

-- Drop duplicate/legacy policies
drop policy if exists "Users can manage own conversations" on conversations;
drop policy if exists "Users can manage their own conversations" on conversations;

-- Select own conversations
create policy "Users can select their own conversations"
on conversations
for select
to public
using (auth.uid() = user_id);

-- Insert own conversations
create policy "Users can insert their own conversations"
on conversations
for insert
to public
with check (auth.uid() = user_id);

-- Update own conversations
create policy "Users can update their own conversations"
on conversations
for update
to public
using (auth.uid() = user_id);

-- Delete own conversations
create policy "Users can delete their own conversations"
on conversations
for delete
to public
using (auth.uid() = user_id);

-- Service role always has full access
create policy "Service role full access"
on conversations
for all
to service_role
using (true);
