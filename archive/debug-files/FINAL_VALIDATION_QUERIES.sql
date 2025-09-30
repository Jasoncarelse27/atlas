-- =======================================================
-- Atlas Tier Gate System - FINAL Validation Queries
-- Skip user creation and use existing user or different UUID
-- =======================================================

-- 1. Verify budgets seeded (should show 3 tiers)
SELECT * FROM tier_budgets ORDER BY tier;

-- 2. Use a different test UUID to avoid conflicts
-- Create initial tier usage record for test user
INSERT INTO tier_usage (user_id, tier, message_count, cost_accumulated)
VALUES ('11111111-1111-1111-1111-111111111111', 'free', 14, 19.00)
ON CONFLICT (user_id, tier) DO UPDATE
  SET message_count = 14, cost_accumulated = 19.00;

-- 3. Try incrementing usage within limits
SELECT increment_usage(
  '11111111-1111-1111-1111-111111111111'::uuid, 
  'free'::text, 
  0.5::numeric
);

-- 4. Check usage after increment (should show 15 messages, 19.50 cost)
SELECT user_id, tier, message_count, cost_accumulated, last_reset 
FROM tier_usage 
WHERE user_id = '11111111-1111-1111-1111-111111111111';

-- 5. Try enforcing budget (should PASS - exactly at message limit)
SELECT enforce_tier_budget(
  '11111111-1111-1111-1111-111111111111'::uuid, 
  'free'::text
) as budget_check_result;

-- 6. Try incrementing usage beyond limit
SELECT increment_usage(
  '11111111-1111-1111-1111-111111111111'::uuid, 
  'free'::text, 
  0.5::numeric
);

-- 7. Check usage after second increment (should show 16 messages)
SELECT user_id, tier, message_count, cost_accumulated 
FROM tier_usage 
WHERE user_id = '11111111-1111-1111-1111-111111111111';

-- 8. Try enforcing budget again (should FAIL - over message limit)
-- This will raise an exception, which is expected behavior
SELECT enforce_tier_budget(
  '11111111-1111-1111-1111-111111111111'::uuid, 
  'free'::text
) as should_fail;

-- 9. Test reset function
SELECT reset_daily_usage();

-- 10. Verify reset worked (should show 0 messages, 0 cost)
SELECT user_id, tier, message_count, cost_accumulated, last_reset 
FROM tier_usage 
WHERE user_id = '11111111-1111-1111-1111-111111111111';

-- =======================================================
-- Expected Results Summary:
-- =======================================================
-- Step 1: 3 rows (free: 15 limit/$20, core: 999999/$100, studio: 999999/$80)
-- Step 4: message_count=15, cost_accumulated=19.50
-- Step 5: Returns true
-- Step 7: message_count=16, cost_accumulated=20.00  
-- Step 8: Raises "Daily message limit reached for tier free"
-- Step 10: message_count=0, cost_accumulated=0
