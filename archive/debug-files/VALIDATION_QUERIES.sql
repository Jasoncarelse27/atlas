-- =======================================================
-- Atlas Tier Gate System - Validation Queries
-- Run these in Supabase SQL Editor after applying migration
-- =======================================================

-- 1. Verify budgets seeded
SELECT * FROM tier_budgets;

-- 2. Create a test free user (replace with real UUID if exists)
INSERT INTO tier_usage (user_id, tier, message_count, cost_accumulated)
VALUES ('00000000-0000-0000-0000-000000000000', 'free', 14, 19.00)
ON CONFLICT (user_id, tier) DO UPDATE
  SET message_count = 14, cost_accumulated = 19.00;

-- 3. Try incrementing usage within limits
SELECT increment_usage('00000000-0000-0000-0000-000000000000', 'free', 0.5);

-- 4. Check usage after increment
SELECT * FROM tier_usage WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- 5. Try enforcing budget (should PASS)
SELECT enforce_tier_budget('00000000-0000-0000-0000-000000000000', 'free');

-- 6. Simulate exceeding budget
UPDATE tier_usage SET message_count = 15 WHERE user_id = '00000000-0000-0000-0000-000000000000' AND tier = 'free';

-- 7. Try enforcing budget again (should FAIL)
SELECT enforce_tier_budget('00000000-0000-0000-0000-000000000000', 'free');

-- Expected behavior:
-- • Query 5 returns true
-- • Query 7 raises: "Daily message limit reached for tier free"
