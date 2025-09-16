-- =====================================================
-- Atlas V1 Tier Enforcement Migration
-- Server-side enforcement of Free/Core/Studio tiers
-- =====================================================

-- 1. Add/verify the subscription_tier field in profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'core', 'studio'));

-- Update existing profiles to have 'free' tier if null
UPDATE profiles 
SET subscription_tier = 'free' 
WHERE subscription_tier IS NULL;

-- 2. Create Message Usage Table
-- Tracks how many messages each user has sent this month
CREATE TABLE IF NOT EXISTS message_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    month_start DATE NOT NULL DEFAULT date_trunc('month', now()),
    message_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(user_id, month_start)
);

-- 3. Create Feature Attempts Table (for analytics)
CREATE TABLE IF NOT EXISTS feature_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,
    tier TEXT NOT NULL,
    allowed BOOLEAN NOT NULL,
    timestamp TIMESTAMP DEFAULT now()
);

-- 4. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_message_usage_user_month ON message_usage(user_id, month_start);
CREATE INDEX IF NOT EXISTS idx_feature_attempts_user_timestamp ON feature_attempts(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);

-- 5. Enable Row Level Security
ALTER TABLE message_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_attempts ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies
-- Users can only see their own message usage
CREATE POLICY "Users can view own message usage" ON message_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own message usage" ON message_usage
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own message usage" ON message_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only see their own feature attempts
CREATE POLICY "Users can view own feature attempts" ON feature_attempts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feature attempts" ON feature_attempts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. Create Function to Enforce Message Limits
CREATE OR REPLACE FUNCTION enforce_message_limit(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    tier TEXT;
    usage INT;
    current_month DATE;
BEGIN
    -- Get current month start
    current_month := date_trunc('month', now())::DATE;
    
    -- Get user tier
    SELECT subscription_tier INTO tier FROM profiles WHERE id = user_id;
    
    -- Default to 'free' if no tier found
    IF tier IS NULL THEN
        tier := 'free';
        -- Update profile with default tier
        UPDATE profiles SET subscription_tier = 'free' WHERE id = user_id;
    END IF;

    -- Get current usage for this month
    SELECT message_count INTO usage
    FROM message_usage
    WHERE user_id = enforce_message_limit.user_id
      AND month_start = current_month;

    -- Initialize if not exists
    IF usage IS NULL THEN
        INSERT INTO message_usage (user_id, month_start, message_count)
        VALUES (user_id, current_month, 0)
        ON CONFLICT (user_id, month_start) DO NOTHING;
        usage := 0;
    END IF;

    -- Enforce limits based on tier
    IF tier = 'free' AND usage >= 15 THEN
        -- Log the blocked attempt
        INSERT INTO feature_attempts (user_id, feature, tier, allowed)
        VALUES (user_id, 'text', tier, false);
        RETURN FALSE; -- Reject
    END IF;

    -- Increment usage
    UPDATE message_usage
    SET message_count = usage + 1, updated_at = now()
    WHERE user_id = enforce_message_limit.user_id
      AND month_start = current_month;

    -- Log the successful attempt
    INSERT INTO feature_attempts (user_id, feature, tier, allowed)
    VALUES (user_id, 'text', tier, true);

    RETURN TRUE; -- Allowed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create Function to Check Feature Access
CREATE OR REPLACE FUNCTION check_feature_access(user_id UUID, feature_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    tier TEXT;
    allowed BOOLEAN := false;
BEGIN
    -- Get user tier
    SELECT subscription_tier INTO tier FROM profiles WHERE id = user_id;
    
    -- Default to 'free' if no tier found
    IF tier IS NULL THEN
        tier := 'free';
    END IF;

    -- Check feature access based on tier
    CASE feature_name
        WHEN 'text' THEN
            allowed := true; -- All tiers can use text
        WHEN 'audio' THEN
            allowed := (tier IN ('core', 'studio'));
        WHEN 'image' THEN
            allowed := (tier IN ('core', 'studio'));
        ELSE
            allowed := false;
    END CASE;

    -- Log the attempt
    INSERT INTO feature_attempts (user_id, feature, tier, allowed)
    VALUES (user_id, feature_name, tier, allowed);

    RETURN allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create Function to Get User Tier Info
CREATE OR REPLACE FUNCTION get_user_tier_info(user_id UUID)
RETURNS JSON AS $$
DECLARE
    tier TEXT;
    usage INT;
    current_month DATE;
    result JSON;
BEGIN
    -- Get current month start
    current_month := date_trunc('month', now())::DATE;
    
    -- Get user tier
    SELECT subscription_tier INTO tier FROM profiles WHERE id = user_id;
    
    -- Default to 'free' if no tier found
    IF tier IS NULL THEN
        tier := 'free';
    END IF;

    -- Get current usage for this month
    SELECT message_count INTO usage
    FROM message_usage
    WHERE user_id = get_user_tier_info.user_id
      AND month_start = current_month;

    -- Initialize if not exists
    IF usage IS NULL THEN
        usage := 0;
    END IF;

    -- Build result JSON
    result := json_build_object(
        'tier', tier,
        'messages_used', usage,
        'messages_limit', CASE 
            WHEN tier = 'free' THEN 15
            ELSE -1 -- Unlimited
        END,
        'can_use_audio', (tier IN ('core', 'studio')),
        'can_use_image', (tier IN ('core', 'studio')),
        'model', CASE 
            WHEN tier = 'studio' THEN 'claude-3-opus-20240229'
            WHEN tier = 'core' THEN 'claude-3-sonnet-20240229'
            ELSE 'claude-3-haiku-20240307'
        END
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Grant necessary permissions
GRANT EXECUTE ON FUNCTION enforce_message_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_feature_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_tier_info(UUID) TO authenticated;

-- 11. Create helpful views for analytics
CREATE OR REPLACE VIEW tier_analytics AS
SELECT 
    p.subscription_tier,
    COUNT(*) as user_count,
    AVG(mu.message_count) as avg_messages_per_month,
    COUNT(CASE WHEN fa.allowed = false THEN 1 END) as blocked_attempts,
    COUNT(CASE WHEN fa.allowed = true THEN 1 END) as successful_attempts
FROM profiles p
LEFT JOIN message_usage mu ON p.id = mu.user_id 
    AND mu.month_start = date_trunc('month', now())
LEFT JOIN feature_attempts fa ON p.id = fa.user_id
    AND fa.timestamp >= date_trunc('month', now())
GROUP BY p.subscription_tier;

-- Grant access to the view
GRANT SELECT ON tier_analytics TO authenticated;

-- =====================================================
-- Migration Complete!
-- =====================================================
-- This migration adds:
-- 1. ✅ subscription_tier field to profiles
-- 2. ✅ message_usage table for monthly tracking
-- 3. ✅ feature_attempts table for analytics
-- 4. ✅ enforce_message_limit() function
-- 5. ✅ check_feature_access() function
-- 6. ✅ get_user_tier_info() function
-- 7. ✅ RLS policies for security
-- 8. ✅ Analytics view for monitoring
-- =====================================================
