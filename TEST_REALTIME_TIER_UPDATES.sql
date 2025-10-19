-- 🧪 LIVE TEST: Real-Time Tier Updates
-- 
-- Instructions:
-- 1. Keep Atlas app open in browser
-- 2. Run this query in Supabase SQL Editor
-- 3. Watch the Atlas UI update INSTANTLY (no refresh!)

-- First, let's see your current tier
SELECT id, email, subscription_tier, updated_at 
FROM profiles 
WHERE email LIKE '%your-email%'; -- Replace with your email

-- Then, test the real-time update:
-- (Replace 'YOUR_USER_ID' with your actual user ID from the query above)

-- Test 1: Change to FREE
UPDATE profiles 
SET subscription_tier = 'free', updated_at = NOW() 
WHERE id = 'YOUR_USER_ID';

-- Wait 2 seconds, watch Atlas update...

-- Test 2: Change to CORE
UPDATE profiles 
SET subscription_tier = 'core', updated_at = NOW() 
WHERE id = 'YOUR_USER_ID';

-- Wait 2 seconds, watch Atlas update...

-- Test 3: Change to STUDIO
UPDATE profiles 
SET subscription_tier = 'studio', updated_at = NOW() 
WHERE id = 'YOUR_USER_ID';

-- ✨ You should see:
-- - Tier badge updates instantly (no page reload!)
-- - Usage counter changes (15 messages vs Unlimited)
-- - Phone button color changes (gray → emerald for Studio)
-- - All happens in <500ms via WebSocket

