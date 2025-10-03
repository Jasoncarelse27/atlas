-- Atlas V1 Test Users Setup
-- Run this in Supabase SQL Editor

-- Create test users (you'll need to create these in Supabase Auth first)
-- Then run this to set up their profiles

INSERT INTO profiles (id, email, subscription_tier, subscription_status, usage_stats, last_reset_date, user_context)
VALUES 
  ('test-free-user-id', 'test-free@atlas.com', 'free', 'active', '{}', NOW(), '{"name": "Test Free User", "context": "testing free tier"}'),
  ('test-core-user-id', 'test-core@atlas.com', 'core', 'active', '{}', NOW(), '{"name": "Test Core User", "context": "testing core tier"}'),
  ('test-studio-user-id', 'test-studio@atlas.com', 'studio', 'active', '{}', NOW(), '{"name": "Test Studio User", "context": "testing studio tier"}');

-- Verify the users were created
SELECT id, email, subscription_tier, subscription_status, usage_stats 
FROM profiles 
WHERE email LIKE 'test-%@atlas.com';
