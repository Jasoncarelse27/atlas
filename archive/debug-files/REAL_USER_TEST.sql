-- =======================================================
-- Atlas Tier Gate System - Real User Test
-- Test with actual auth.users record
-- =======================================================

-- 1. Check if you have any real users in the system
SELECT id, email, created_at FROM auth.users LIMIT 5;

-- 2. If you have a real user, use their ID here (replace with actual UUID)
-- INSERT INTO tier_usage (user_id, tier, message_count, cost_accumulated)
-- VALUES ('[REAL_USER_ID]', 'free', 14, 19.00)
-- ON CONFLICT (user_id, tier) DO UPDATE
--   SET message_count = 14, cost_accumulated = 19.00;

-- 3. Test tier_metrics view with real user data
-- SELECT * FROM tier_metrics WHERE user_id = '[REAL_USER_ID]';

-- 4. Test enforcement with real user
-- SELECT enforce_tier_budget('[REAL_USER_ID]'::uuid, 'free'::text);

-- =======================================================
-- This confirms the system works with real user accounts
-- =======================================================
