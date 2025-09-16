-- Phase 5 Test: Verify conversations.updated_at is refreshed on new message insert

-- 1. Create a fake user
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-000000000001', 'testuser@atlas.app')
on conflict (id) do nothing;

-- 2. Create a conversation for this user
insert into public.conversations (id, user_id, title, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000001',
        'Test Conversation',
        now(),
        now())
on conflict (id) do nothing;

-- 3. Capture the old updated_at
select updated_at as old_updated_at
from public.conversations
where id = '11111111-1111-1111-1111-111111111111';

-- 4. Insert a new message (this should trigger updated_at refresh)
insert into public.messages (id, conversation_id, user_id, role, content, created_at)
values ('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000001',
        'user',
        'Hello Atlas!',
        now());

-- 5. Verify updated_at is greater than old_updated_at
select updated_at as new_updated_at
from public.conversations
where id = '11111111-1111-1111-1111-111111111111';
