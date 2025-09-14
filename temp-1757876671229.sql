
SELECT email, subscription_tier, status, bounce_reason, updated_at
FROM profiles
WHERE email = 'test-1757876669987@demo.com'
ORDER BY updated_at DESC;
