-- =======================================================
-- Atlas Tier Gate System - CORRECTED Validation Queries
-- Run these in Supabase SQL Editor after applying migration
-- =======================================================

-- 1. Verify budgets seeded
SELECT * FROM tier_budgets ORDER BY tier;

-- 2. Create a test user in auth.users first (if needed)
-- Note: This creates a test user - replace UUID with real user ID in production
INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'test@atlas.app',
  now(),
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- 3. Create initial tier usage record for test user
INSERT INTO tier_usage (user_id, tier, message_count, cost_accumulated)
VALUES ('00000000-0000-0000-0000-000000000000', 'free', 14, 19.00)
ON CONFLICT (user_id, tier) DO UPDATE
  SET message_count = 14, cost_accumulated = 19.00;

-- 4. Try incrementing usage within limits (correct function call)
SELECT increment_usage(
  '00000000-0000-0000-0000-000000000000'::uuid, 
  'free'::text, 
  0.5::numeric
);

-- 5. Check usage after increment (should show 15 messages, 19.50 cost)
SELECT * FROM tier_usage WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- 6. Try enforcing budget (should PASS - exactly at limit)
SELECT enforce_tier_budget(
  '00000000-0000-0000-0000-000000000000'::uuid, 
  'free'::text
);

-- 7. Try incrementing usage beyond limit
SELECT increment_usage(
  '00000000-0000-0000-0000-000000000000'::uuid, 
  'free'::text, 
  0.5::numeric
);

-- 8. Try enforcing budget again (should FAIL - over limit)
SELECT enforce_tier_budget(
  '00000000-0000-0000-0000-000000000000'::uuid, 
  'free'::text
);

-- 9. Test tier_metrics view
SELECT * FROM tier_metrics WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- 10. Test reset function
SELECT reset_daily_usage();

-- 11. Verify reset worked
SELECT * FROM tier_usage WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- Expected behavior:
-- • Step 1: Shows 3 tier records (free: 15 limit, $20 ceiling; core: 999999, $100; studio: 999999, $80)
-- • Step 5: Shows message_count=15, cost_accumulated=19.50
-- • Step 6: Returns true (exactly at message limit but under cost ceiling)
-- • Step 8: Raises "Daily message limit reached for tier free"
-- • Step 9: Shows user with tier info from tier_metrics view
-- • Step 11: Shows message_count=0, cost_accumulated=0 after reset
