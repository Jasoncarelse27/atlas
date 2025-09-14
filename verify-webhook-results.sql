-- Verify MailerLite Webhook Results
-- Run this in Supabase SQL Editor to check profiles table updates

-- 1. Check recent profile updates (last 24 hours)
SELECT 
    email,
    subscription_tier,
    status,
    bounce_reason,
    updated_at,
    created_at
FROM profiles 
WHERE updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC
LIMIT 20;

-- 2. Check for test emails specifically
SELECT 
    email,
    subscription_tier,
    status,
    bounce_reason,
    updated_at
FROM profiles 
WHERE email LIKE '%demo.com%' OR email LIKE '%test%'
ORDER BY updated_at DESC;

-- 3. Check for different subscription tiers
SELECT 
    subscription_tier,
    COUNT(*) as count,
    MAX(updated_at) as latest_update
FROM profiles 
GROUP BY subscription_tier
ORDER BY count DESC;

-- 4. Check for different statuses
SELECT 
    status,
    COUNT(*) as count,
    MAX(updated_at) as latest_update
FROM profiles 
GROUP BY status
ORDER BY count DESC;

-- 5. Check for bounce reasons
SELECT 
    bounce_reason,
    COUNT(*) as count,
    MAX(updated_at) as latest_update
FROM profiles 
WHERE bounce_reason IS NOT NULL
GROUP BY bounce_reason
ORDER BY count DESC;
