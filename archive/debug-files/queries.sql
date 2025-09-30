-- Atlas Analytics Dashboard Queries
-- Copy and paste these into Supabase SQL Editor and save them as named queries

-- ============================================
-- Query 1: Feature Attempts by Tier
-- Save as: "Feature Attempts by Tier"
-- ============================================
SELECT 
  p.subscription_tier,
  fa.feature,
  COUNT(*) AS attempts,
  COUNT(CASE WHEN fa.allowed = true THEN 1 END) AS allowed_attempts,
  COUNT(CASE WHEN fa.upgrade_shown = true THEN 1 END) AS upgrade_prompts_shown,
  ROUND(
    COUNT(CASE WHEN fa.allowed = true THEN 1 END)::decimal / COUNT(*) * 100, 2
  ) AS success_rate_percent
FROM feature_attempts fa
JOIN profiles p ON fa.user_id = p.id
WHERE fa.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY p.subscription_tier, fa.feature
ORDER BY attempts DESC;

-- ============================================
-- Query 2: Free Users Upgrade Prompts
-- Save as: "Free Users Upgrade Prompts"
-- ============================================
SELECT 
  fa.feature,
  COUNT(*) AS upgrade_prompts,
  COUNT(DISTINCT fa.user_id) AS unique_users_prompted,
  DATE_TRUNC('day', fa.timestamp) AS day,
  ROUND(AVG(COUNT(*)) OVER (PARTITION BY fa.feature ORDER BY DATE_TRUNC('day', fa.timestamp)), 2) AS avg_daily_prompts
FROM feature_attempts fa
JOIN profiles p ON fa.user_id = p.id
WHERE p.subscription_tier = 'free'
  AND fa.upgrade_shown = true
  AND fa.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY fa.feature, DATE_TRUNC('day', fa.timestamp)
ORDER BY day DESC, upgrade_prompts DESC;

-- ============================================
-- Query 3: Conversion After Upgrade Prompt
-- Save as: "Upgrade Conversion Funnel"
-- ============================================
SELECT 
  fa.feature,
  COUNT(DISTINCT fa.user_id) AS users_prompted,
  COUNT(DISTINCT CASE WHEN p.subscription_tier IN ('core','studio') THEN fa.user_id END) AS users_upgraded,
  ROUND(
    COUNT(DISTINCT CASE WHEN p.subscription_tier IN ('core','studio') THEN fa.user_id END)::decimal / 
    COUNT(DISTINCT fa.user_id) * 100, 2
  ) AS conversion_rate_percent,
  COUNT(DISTINCT CASE WHEN p.subscription_tier = 'core' THEN fa.user_id END) AS core_conversions,
  COUNT(DISTINCT CASE WHEN p.subscription_tier = 'studio' THEN fa.user_id END) AS studio_conversions
FROM feature_attempts fa
JOIN profiles p ON fa.user_id = p.id
WHERE fa.upgrade_shown = true
  AND fa.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY fa.feature
ORDER BY conversion_rate_percent DESC;

-- ============================================
-- Query 4: Locked vs Unlocked Usage
-- Save as: "Locked vs Unlocked Feature Usage"
-- ============================================
SELECT 
  fa.feature,
  p.subscription_tier,
  SUM(CASE WHEN fa.upgrade_shown = true THEN 1 ELSE 0 END) AS blocked_attempts,
  SUM(CASE WHEN fa.upgrade_shown = false AND fa.allowed = true THEN 1 ELSE 0 END) AS successful_usage,
  SUM(CASE WHEN fa.upgrade_shown = false AND fa.allowed = false THEN 1 ELSE 0 END) AS failed_attempts,
  COUNT(*) AS total_attempts,
  ROUND(
    SUM(CASE WHEN fa.upgrade_shown = false AND fa.allowed = true THEN 1 ELSE 0 END)::decimal / 
    COUNT(*) * 100, 2
  ) AS success_rate_percent
FROM feature_attempts fa
JOIN profiles p ON fa.user_id = p.id
WHERE fa.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY fa.feature, p.subscription_tier
ORDER BY fa.feature, p.subscription_tier;

-- ============================================
-- Query 5: Daily Feature Attempts Trend
-- Save as: "Daily Feature Attempts Trend"
-- ============================================
SELECT 
  DATE(fa.timestamp) AS day,
  fa.feature,
  p.subscription_tier,
  COUNT(*) AS attempts,
  COUNT(CASE WHEN fa.allowed = true THEN 1 END) AS successful_attempts,
  COUNT(CASE WHEN fa.upgrade_shown = true THEN 1 END) AS upgrade_prompts
FROM feature_attempts fa
JOIN profiles p ON fa.user_id = p.id
WHERE fa.timestamp >= NOW() - INTERVAL '14 days'
GROUP BY DATE(fa.timestamp), fa.feature, p.subscription_tier
ORDER BY day DESC, attempts DESC;

-- ============================================
-- Query 6: Feature Usage by User Segment
-- Save as: "Feature Usage by User Segment"
-- ============================================
SELECT 
  p.subscription_tier,
  CASE 
    WHEN p.created_at >= NOW() - INTERVAL '7 days' THEN 'new_users'
    WHEN p.created_at >= NOW() - INTERVAL '30 days' THEN 'recent_users'
    ELSE 'established_users'
  END AS user_segment,
  fa.feature,
  COUNT(*) AS total_attempts,
  COUNT(DISTINCT fa.user_id) AS unique_users,
  ROUND(COUNT(*)::decimal / COUNT(DISTINCT fa.user_id), 2) AS avg_attempts_per_user
FROM feature_attempts fa
JOIN profiles p ON fa.user_id = p.id
WHERE fa.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY p.subscription_tier, user_segment, fa.feature
ORDER BY total_attempts DESC;

-- ============================================
-- Query 7: Hourly Feature Usage Pattern
-- Save as: "Hourly Feature Usage Pattern"
-- ============================================
SELECT 
  EXTRACT(HOUR FROM fa.timestamp) AS hour_of_day,
  fa.feature,
  COUNT(*) AS attempts,
  COUNT(DISTINCT fa.user_id) AS unique_users
FROM feature_attempts fa
WHERE fa.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY EXTRACT(HOUR FROM fa.timestamp), fa.feature
ORDER BY hour_of_day, attempts DESC;

-- ============================================
-- Query 8: Top Users by Feature Attempts
-- Save as: "Top Users by Feature Attempts"
-- ============================================
SELECT 
  fa.user_id,
  p.email,
  p.subscription_tier,
  fa.feature,
  COUNT(*) AS total_attempts,
  COUNT(CASE WHEN fa.allowed = true THEN 1 END) AS successful_attempts,
  COUNT(CASE WHEN fa.upgrade_shown = true THEN 1 END) AS upgrade_prompts_seen,
  MAX(fa.timestamp) AS last_attempt
FROM feature_attempts fa
JOIN profiles p ON fa.user_id = p.id
WHERE fa.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY fa.user_id, p.email, p.subscription_tier, fa.feature
HAVING COUNT(*) >= 5  -- Only show users with 5+ attempts
ORDER BY total_attempts DESC
LIMIT 50;

-- ============================================
-- Query 9: Feature Attempt Success Rates
-- Save as: "Feature Attempt Success Rates"
-- ============================================
SELECT 
  fa.feature,
  COUNT(*) AS total_attempts,
  COUNT(CASE WHEN fa.allowed = true THEN 1 END) AS successful_attempts,
  COUNT(CASE WHEN fa.upgrade_shown = true THEN 1 END) AS blocked_attempts,
  COUNT(CASE WHEN fa.allowed = false AND fa.upgrade_shown = false THEN 1 END) AS failed_attempts,
  ROUND(
    COUNT(CASE WHEN fa.allowed = true THEN 1 END)::decimal / COUNT(*) * 100, 2
  ) AS success_rate_percent,
  ROUND(
    COUNT(CASE WHEN fa.upgrade_shown = true THEN 1 END)::decimal / COUNT(*) * 100, 2
  ) AS blocked_rate_percent
FROM feature_attempts fa
WHERE fa.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY fa.feature
ORDER BY success_rate_percent DESC;

-- ============================================
-- Query 10: Upgrade Intent Tracking
-- Save as: "Upgrade Intent Tracking"
-- ============================================
SELECT 
  DATE(fa.timestamp) AS day,
  fa.feature,
  COUNT(CASE WHEN fa.upgrade_shown = true THEN 1 END) AS upgrade_prompts_shown,
  COUNT(DISTINCT CASE WHEN fa.upgrade_shown = true THEN fa.user_id END) AS users_prompted,
  COUNT(DISTINCT CASE 
    WHEN fa.upgrade_shown = true 
    AND EXISTS (
      SELECT 1 FROM feature_attempts fa2 
      WHERE fa2.user_id = fa.user_id 
      AND fa2.timestamp > fa.timestamp 
      AND fa2.feature = fa.feature 
      AND fa2.allowed = true
    ) 
    THEN fa.user_id 
  END) AS users_who_used_after_prompt
FROM feature_attempts fa
WHERE fa.timestamp >= NOW() - INTERVAL '14 days'
GROUP BY DATE(fa.timestamp), fa.feature
ORDER BY day DESC, upgrade_prompts_shown DESC;
