-- =====================
-- Manual Test User Insertion (for Supabase SQL Editor)
-- =====================

-- Insert test users into profiles table
INSERT INTO profiles (id, email, subscription_tier, subscription_status, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'freeuser@test.com', 'free', 'active', now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'coreuser@test.com', 'core', 'active', now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'studiouser@test.com', 'studio', 'active', now(), now())
ON CONFLICT (id) DO UPDATE SET 
  subscription_tier = EXCLUDED.subscription_tier,
  subscription_status = EXCLUDED.subscription_status,
  updated_at = now();

-- Insert test conversations
INSERT INTO conversations (id, user_id, title, created_at, updated_at)
VALUES 
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Free tier test conversation', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Core tier test conversation', now(), now()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Studio tier test conversation', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Insert test messages
INSERT INTO messages (id, conversation_id, role, content, created_at)
VALUES 
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'user', 'Hi Atlas, I''m testing the free tier.', now()),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'assistant', 'Welcome! You have 15 free messages per day. Audio and image features are disabled.', now()),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'user', 'Testing Core tier features.', now()),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'assistant', 'Great! As a Core user, you have unlimited messages and access to audio + image features.', now()),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'user', 'Testing Studio tier premium access.', now()),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'assistant', 'Welcome, Studio user! You have full access to Atlas including premium model routing and priority support.', now())
ON CONFLICT (id) DO NOTHING;

-- Success message
SELECT '✅ Test users inserted successfully!' as status;
