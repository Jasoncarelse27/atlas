-- Create test accounts for Atlas tier gating validation
-- Run this in Supabase SQL Editor

-- Option 1: Use real email addresses (recommended)
INSERT INTO profiles (id, email, subscription_tier, subscription_status, created_at, updated_at) VALUES
  ('test-free-uuid-1', 'free_tester@atlas.app', 'free', 'active', now(), now()),
  ('test-core-uuid-1', 'core_tester@atlas.app', 'core', 'active', now(), now()),
  ('test-studio-uuid-1', 'studio_tester@atlas.app', 'studio', 'active', now(), now());

-- Option 2: Use your own email with different tiers for testing
-- INSERT INTO profiles (id, email, subscription_tier, subscription_status, created_at, updated_at) VALUES
--   ('test-free-uuid-2', 'your-email+free@domain.com', 'free', 'active', now(), now()),
--   ('test-core-uuid-2', 'your-email+core@domain.com', 'core', 'active', now(), now()),
--   ('test-studio-uuid-2', 'your-email+studio@domain.com', 'studio', 'active', now(), now());

-- Verify the test accounts were created
SELECT id, email, subscription_tier, subscription_status, created_at 
FROM profiles 
WHERE email LIKE '%tester%' 
ORDER BY subscription_tier;
