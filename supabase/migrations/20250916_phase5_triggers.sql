-- Phase 5: Atlas Database Automation Triggers
-- This migration creates triggers for automatic conversation management
-- Tables: messages, conversations (from 20250115_atlas_v1_schema.sql)

-- 1. Trigger: Update conversation updated_at when messages are inserted
create or replace function update_conversation_timestamp()
returns trigger as $$
begin
  update conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

-- Drop existing triggers to ensure idempotent migration
drop trigger if exists trg_update_conversation_timestamp on messages;

-- Create trigger for message inserts
create trigger trg_update_conversation_timestamp
after insert on messages
for each row
execute procedure update_conversation_timestamp();

-- 2. Trigger: Auto-generate conversation title if null
create or replace function set_default_conversation_title()
returns trigger as $$
declare
  first_msg text;
begin
  if new.title is null or length(trim(new.title)) = 0 then
    select content
    into first_msg
    from messages
    where conversation_id = new.id
    order by created_at asc
    limit 1;

    if first_msg is not null then
      new.title := left(first_msg, 50);
    else
      new.title := 'New Conversation';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

-- Drop existing trigger to ensure idempotent migration
drop trigger if exists trg_set_conversation_title on conversations;

-- Create trigger for conversation inserts
create trigger trg_set_conversation_title
before insert on conversations
for each row
execute procedure set_default_conversation_title();

-- TESTING ONLY: uncomment to validate triggers work
-- insert into messages (user_id, conversation_id, content, role)
-- values ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Hello Phase 5!', 'user');
--
-- select id, updated_at from conversations where id = '11111111-1111-1111-1111-111111111111';
