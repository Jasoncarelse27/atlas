-- Atlas V1 Database Schema - Chat-Focused System
-- Date: 2025-01-15
-- Purpose: Complete V1 chat-focused system with Free/Core/Studio tiers

-- 1. Update profiles table for V1 tier system
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'core', 'studio')),
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'expired', 'cancelled', 'trial')),
  ADD COLUMN IF NOT EXISTS subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_payment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reset_date TIMESTAMPTZ DEFAULT NOW();

-- 2. Create usage tracking table for V1 system
CREATE TABLE IF NOT EXISTS user_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: '2025-01'
  text_messages_count INTEGER DEFAULT 0,
  audio_minutes_count INTEGER DEFAULT 0,
  image_uploads_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- 3. Create conversations table (for persistent memory)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  is_personal_reflection BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create messages table (enhanced for V1)
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'voice', 'image')),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  metadata JSONB, -- Store image URLs, voice transcripts, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create subscription events table (for analytics)
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'upgrade', 'downgrade', 'cancellation', 'trial_start', 'trial_end'
  from_tier TEXT,
  to_tier TEXT,
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_usage_user_month ON user_usage(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user ON subscription_events(user_id, created_at);

-- 7. Create RLS policies
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own usage" ON user_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON user_usage FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage" ON user_usage FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own conversations" ON conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own messages" ON messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own subscription events" ON subscription_events FOR SELECT USING (auth.uid() = user_id);

-- 8. Create functions for usage tracking
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id UUID,
  p_usage_type TEXT,
  p_amount INTEGER DEFAULT 1
) RETURNS VOID AS $$
DECLARE
  current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
BEGIN
  INSERT INTO user_usage (user_id, month_year, text_messages_count, audio_minutes_count, image_uploads_count)
  VALUES (p_user_id, current_month, 
    CASE WHEN p_usage_type = 'text' THEN p_amount ELSE 0 END,
    CASE WHEN p_usage_type = 'audio' THEN p_amount ELSE 0 END,
    CASE WHEN p_usage_type = 'image' THEN p_amount ELSE 0 END
  )
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET
    text_messages_count = user_usage.text_messages_count + CASE WHEN p_usage_type = 'text' THEN p_amount ELSE 0 END,
    audio_minutes_count = user_usage.audio_minutes_count + CASE WHEN p_usage_type = 'audio' THEN p_amount ELSE 0 END,
    image_uploads_count = user_usage.image_uploads_count + CASE WHEN p_usage_type = 'image' THEN p_amount ELSE 0 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(
  p_user_id UUID,
  p_usage_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
  current_usage INTEGER;
  usage_limit INTEGER;
  current_month TEXT := TO_CHAR(NOW(), 'YYYY-MM');
BEGIN
  -- Get user tier
  SELECT subscription_tier INTO user_tier FROM profiles WHERE id = p_user_id;
  
  -- Get current usage
  SELECT 
    CASE p_usage_type
      WHEN 'text' THEN text_messages_count
      WHEN 'audio' THEN audio_minutes_count
      WHEN 'image' THEN image_uploads_count
      ELSE 0
    END INTO current_usage
  FROM user_usage 
  WHERE user_id = p_user_id AND month_year = current_month;
  
  -- Set limits based on tier
  CASE user_tier
    WHEN 'free' THEN
      CASE p_usage_type
        WHEN 'text' THEN usage_limit := 15;
        WHEN 'audio' THEN usage_limit := 0;
        WHEN 'image' THEN usage_limit := 0;
      END CASE;
    WHEN 'core' THEN
      CASE p_usage_type
        WHEN 'text' THEN usage_limit := -1; -- Unlimited
        WHEN 'audio' THEN usage_limit := 60;
        WHEN 'image' THEN usage_limit := 10;
      END CASE;
    WHEN 'studio' THEN
      usage_limit := -1; -- Unlimited for all
  END CASE;
  
  -- Return true if within limits
  RETURN usage_limit = -1 OR current_usage < usage_limit;
END;
$$ LANGUAGE plpgsql;
