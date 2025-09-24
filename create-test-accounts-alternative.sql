-- Alternative: Use your own email with different tiers for testing
-- This is useful if you want to test with real email addresses you control

-- Replace 'your-email@domain.com' with your actual email
INSERT INTO profiles (id, email, subscription_tier, subscription_status, created_at, updated_at) VALUES
  ('test-free-uuid-alt', 'your-email+free@domain.com', 'free', 'active', now(), now()),
  ('test-core-uuid-alt', 'your-email+core@domain.com', 'core', 'active', now(), now()),
  ('test-studio-uuid-alt', 'your-email+studio@domain.com', 'studio', 'active', now(), now());

-- Or use the same email but different UUIDs (for testing different tiers)
-- INSERT INTO profiles (id, email, subscription_tier, subscription_status, created_at, updated_at) VALUES
--   ('test-free-uuid-same', 'your-email@domain.com', 'free', 'active', now(), now()),
--   ('test-core-uuid-same', 'your-email@domain.com', 'core', 'active', now(), now()),
--   ('test-studio-uuid-same', 'your-email@domain.com', 'studio', 'active', now(), now());

-- Verify the test accounts
SELECT id, email, subscription_tier, subscription_status, created_at 
FROM profiles 
WHERE email LIKE '%your-email%' 
ORDER BY subscription_tier;
