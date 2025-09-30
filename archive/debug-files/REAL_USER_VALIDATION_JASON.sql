-- =======================================================
-- Atlas Tier Gate System - REAL USER VALIDATION
-- Testing with Jason's actual email: jasonc.jpg@gmail.com
-- =======================================================

-- 1. Create a real test user (if not already in auth.users)
INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
VALUES (
  gen_random_uuid(), 
  'jasonc.jpg@gmail.com', 
  '{}'::jsonb,
  now(),
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING
RETURNING id, email;

-- 2. Link the new user to profiles
INSERT INTO profiles (id, email, subscription_tier, created_at)
SELECT id, email, 'free', now()
FROM auth.users
WHERE email = 'jasonc.jpg@gmail.com'
ON CONFLICT (id) DO NOTHING
RETURNING id, email, subscription_tier;

-- 3. Initialize tier_usage for Jason
INSERT INTO tier_usage (user_id, tier, message_count, cost_accumulated, last_reset)
SELECT id, 'free', 0, 0, now()
FROM auth.users
WHERE email = 'jasonc.jpg@gmail.com'
ON CONFLICT (user_id, tier) DO UPDATE
SET message_count = 0, cost_accumulated = 0, last_reset = now()
RETURNING user_id, tier, message_count, cost_accumulated;

-- 4. Simulate 14 messages to get close to limit
DO $$
DECLARE
  jason_id uuid;
  i integer;
BEGIN
  SELECT id INTO jason_id FROM auth.users WHERE email = 'jasonc.jpg@gmail.com';
  
  FOR i IN 1..14 LOOP
    PERFORM increment_usage(jason_id, 'free', 0.05);
  END LOOP;
END $$;

-- 5. Check Jason's usage (should show 14 messages, $0.70)
SELECT 
  u.email,
  tu.tier,
  tu.message_count,
  tu.cost_accumulated,
  tu.last_reset,
  tb.daily_limit,
  tb.budget_ceiling
FROM tier_usage tu
JOIN auth.users u ON u.id = tu.user_id
JOIN tier_budgets tb ON tb.tier = tu.tier
WHERE u.email = 'jasonc.jpg@gmail.com';

-- 6. Test enforcement (should PASS - under 15 message limit)
SELECT enforce_tier_budget(
  (SELECT id FROM auth.users WHERE email = 'jasonc.jpg@gmail.com'),
  'free'
) as "Budget Check Result (Should Pass)";

-- 7. Add one more message to hit exactly 15
SELECT increment_usage(
  (SELECT id FROM auth.users WHERE email = 'jasonc.jpg@gmail.com'),
  'free',
  0.05
);

-- 8. Check usage at limit (should show 15 messages, $0.75)
SELECT 
  u.email,
  tu.message_count,
  tu.cost_accumulated,
  'AT LIMIT' as status
FROM tier_usage tu
JOIN auth.users u ON u.id = tu.user_id
WHERE u.email = 'jasonc.jpg@gmail.com';

-- 9. Test enforcement at limit (should still PASS - exactly at 15)
SELECT enforce_tier_budget(
  (SELECT id FROM auth.users WHERE email = 'jasonc.jpg@gmail.com'),
  'free'
) as "Budget Check at Limit (Should Pass)";

-- 10. Try to add message #16 (this should work but put us over)
SELECT increment_usage(
  (SELECT id FROM auth.users WHERE email = 'jasonc.jpg@gmail.com'),
  'free',
  0.05
);

-- 11. NOW test enforcement (should FAIL - over 15 message limit)
SELECT enforce_tier_budget(
  (SELECT id FROM auth.users WHERE email = 'jasonc.jpg@gmail.com'),
  'free'
) as "Budget Check Over Limit (Should Fail with Exception)";

-- 12. Final status check
SELECT 
  u.email,
  tu.message_count,
  tu.cost_accumulated,
  'OVER LIMIT - SHOULD BLOCK' as status
FROM tier_usage tu
JOIN auth.users u ON u.id = tu.user_id
WHERE u.email = 'jasonc.jpg@gmail.com';

-- =======================================================
-- EXPECTED RESULTS:
-- Step 5: 14 messages, $0.70, under limit
-- Step 6: Returns TRUE (budget check passes)
-- Step 8: 15 messages, $0.75, at limit  
-- Step 9: Returns TRUE (still passes at exactly 15)
-- Step 11: RAISES EXCEPTION "Daily message limit reached for tier free"
-- Step 12: 16 messages, $0.80, blocked status
-- =======================================================
