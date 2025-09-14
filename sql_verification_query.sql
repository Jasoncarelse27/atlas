-- MailerLite Webhook Verification Query
-- Run this in Supabase SQL Editor

-- Check our test email
SELECT 
    email,
    subscription_tier,
    status,
    bounce_reason,
    updated_at,
    created_at
FROM profiles 
WHERE email = 'verification-1757873445@demo.com'
ORDER BY updated_at DESC;

-- Check all recent test emails
SELECT 
    email,
    subscription_tier,
    status,
    bounce_reason,
    updated_at
FROM profiles 
WHERE email LIKE '%demo.com%' OR email LIKE '%test%'
ORDER BY updated_at DESC
LIMIT 10;

-- Check subscription tier distribution
SELECT 
    subscription_tier,
    COUNT(*) as count,
    MAX(updated_at) as latest_update
FROM profiles 
GROUP BY subscription_tier
ORDER BY count DESC;

-- Check status distribution
SELECT 
    status,
    COUNT(*) as count,
    MAX(updated_at) as latest_update
FROM profiles 
GROUP BY status
ORDER BY count DESC;
