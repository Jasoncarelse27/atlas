-- Verify schema test results
-- Run this in Supabase SQL Editor after applying migration

-- Check if columns exist
SELECT 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('subscription_tier', 'status', 'bounce_reason')
ORDER BY column_name;

-- Check our test email
SELECT 
    email,
    subscription_tier,
    status,
    bounce_reason,
    updated_at,
    created_at
FROM profiles 
WHERE email = 'schema-test-1757874629@demo.com'
ORDER BY updated_at DESC;

-- Check recent test emails
SELECT 
    email,
    subscription_tier,
    status,
    bounce_reason,
    updated_at
FROM profiles 
WHERE email LIKE '%schema-test%' OR email LIKE '%demo.com%'
ORDER BY updated_at DESC
LIMIT 10;
