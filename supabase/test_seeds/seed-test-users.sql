-- =====================
-- Atlas Tier Testing Seed - Create Free/Core/Studio Test Users
-- =====================

-- =====================
-- FREE USER
-- =====================
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000001', 
  'freeuser@test.com',
  crypt('testpass123', gen_salt('bf')),
  now(),
  now(),
  now()
)
on conflict (id) do nothing;

insert into profiles (id, email, subscription_tier, subscription_status, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000001', 
  'freeuser@test.com',
  'free',
  'active',
  now(),
  now()
)
on conflict (id) do update set subscription_tier = 'free';

-- Fake Paddle subscription record
insert into paddle_subscriptions (id, user_id, plan_id, status, created_at, updated_at)
values (
  'sub_free_0001',
  '00000000-0000-0000-0000-000000000001',
  'plan_free',
  'active',
  now(),
  now()
) on conflict (id) do nothing;

-- Conversation + messages
insert into conversations (id, user_id, title, created_at, updated_at)
values (
  '10000000-0000-0000-0000-000000000001', 
  '00000000-0000-0000-0000-000000000001', 
  'Free tier test conversation',
  now(),
  now()
)
on conflict (id) do nothing;

insert into messages (id, conversation_id, role, content, created_at)
values 
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'user', 'Hi Atlas, I''m testing the free tier.', now()),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'assistant', 'Welcome! You have 15 free messages per day. Audio and image features are disabled.', now())
on conflict (id) do nothing;


-- =====================
-- CORE USER
-- =====================
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000002', 
  'coreuser@test.com',
  crypt('testpass123', gen_salt('bf')),
  now(),
  now(),
  now()
)
on conflict (id) do nothing;

insert into profiles (id, email, subscription_tier, subscription_status, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000002', 
  'coreuser@test.com',
  'core',
  'active',
  now(),
  now()
)
on conflict (id) do update set subscription_tier = 'core';

-- Fake Paddle subscription record
insert into paddle_subscriptions (id, user_id, plan_id, status, created_at, updated_at)
values (
  'sub_core_0001',
  '00000000-0000-0000-0000-000000000002',
  'plan_core',
  'active',
  now(),
  now()
) on conflict (id) do nothing;

-- Conversation + messages
insert into conversations (id, user_id, title, created_at, updated_at)
values (
  '10000000-0000-0000-0000-000000000002', 
  '00000000-0000-0000-0000-000000000002', 
  'Core tier test conversation',
  now(),
  now()
)
on conflict (id) do nothing;

insert into messages (id, conversation_id, role, content, created_at)
values 
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'user', 'Testing Core tier features.', now()),
('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'assistant', 'Great! As a Core user, you have unlimited messages and access to audio + image features.', now())
on conflict (id) do nothing;


-- =====================
-- STUDIO USER
-- =====================
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000003', 
  'studiouser@test.com',
  crypt('testpass123', gen_salt('bf')),
  now(),
  now(),
  now()
)
on conflict (id) do nothing;

insert into profiles (id, email, subscription_tier, subscription_status, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000003', 
  'studiouser@test.com',
  'studio',
  'active',
  now(),
  now()
)
on conflict (id) do update set subscription_tier = 'studio';

-- Fake Paddle subscription record
insert into paddle_subscriptions (id, user_id, plan_id, status, created_at, updated_at)
values (
  'sub_studio_0001',
  '00000000-0000-0000-0000-000000000003',
  'plan_studio',
  'active',
  now(),
  now()
) on conflict (id) do nothing;

-- Conversation + messages
insert into conversations (id, user_id, title, created_at, updated_at)
values (
  '10000000-0000-0000-0000-000000000003', 
  '00000000-0000-0000-0000-000000000003', 
  'Studio tier test conversation',
  now(),
  now()
)
on conflict (id) do nothing;

insert into messages (id, conversation_id, role, content, created_at)
values 
('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'user', 'Testing Studio tier premium access.', now()),
('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'assistant', 'Welcome, Studio user! You have full access to Atlas including premium model routing and priority support.', now())
on conflict (id) do nothing;

-- =====================
-- SUCCESS MESSAGE
-- =====================
DO $$
BEGIN
  RAISE NOTICE '✅ Test users created successfully!';
  RAISE NOTICE 'Free: freeuser@test.com (password: testpass123)';
  RAISE NOTICE 'Core: coreuser@test.com (password: testpass123)';
  RAISE NOTICE 'Studio: studiouser@test.com (password: testpass123)';
END $$;
