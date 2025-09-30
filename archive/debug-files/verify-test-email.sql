-- Verify test email was processed
SELECT 
    email,
    subscription_tier,
    status,
    bounce_reason,
    updated_at,
    created_at
FROM profiles 
WHERE email = 'test-1757876176@demo.com'
ORDER BY updated_at DESC;
