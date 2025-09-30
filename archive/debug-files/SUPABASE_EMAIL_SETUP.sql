-- Atlas AI Email Intelligence Setup
-- This file contains all SQL commands needed to set up email functionality

-- 1. Create email_logs table for tracking
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_type TEXT NOT NULL CHECK (flow_type IN ('welcome', 'upgrade_nudge', 'inactivity_reminder', 'weekly_summary')),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create user_activity table for tracking inactivity
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  conversation_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create user_subscription table for upgrade tracking
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'core', 'studio')),
  usage_count INTEGER DEFAULT 0,
  usage_limit INTEGER DEFAULT 10,
  last_upgrade_nudge TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS on all tables
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for email_logs
CREATE POLICY "Users can view their own email logs" ON email_logs
  FOR SELECT USING (auth.uid() = recipient_user_id);

CREATE POLICY "Service role can manage email logs" ON email_logs
  FOR ALL USING (auth.role() = 'service_role');

-- 6. Create RLS policies for user_activity
CREATE POLICY "Users can view their own activity" ON user_activity
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity" ON user_activity
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage user activity" ON user_activity
  FOR ALL USING (auth.role() = 'service_role');

-- 7. Create RLS policies for user_subscriptions
CREATE POLICY "Users can view their own subscription" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions" ON user_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- 8. Create function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert user activity record
  INSERT INTO user_activity (user_id, last_activity)
  VALUES (NEW.id, NOW());
  
  -- Insert user subscription record
  INSERT INTO user_subscriptions (user_id, tier, usage_limit)
  VALUES (NEW.id, 'free', 10);
  
  -- Send welcome email via Edge Function
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-welcome',
    headers := json_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := json_build_object(
      'email', NEW.email,
      'name', COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name')
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create trigger for new user registration
DROP TRIGGER IF EXISTS send_welcome_email ON auth.users;
CREATE TRIGGER send_welcome_email
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 10. Create function to track user activity
CREATE OR REPLACE FUNCTION update_user_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user activity on message creation
  INSERT INTO user_activity (user_id, last_activity, message_count)
  VALUES (NEW.user_id, NOW(), 1)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    last_activity = NOW(),
    message_count = user_activity.message_count + 1,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create trigger for message activity tracking
DROP TRIGGER IF EXISTS track_message_activity ON messages;
CREATE TRIGGER track_message_activity
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_user_activity();

-- 12. Create function to check usage limits and send upgrade nudge
CREATE OR REPLACE FUNCTION check_usage_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_sub user_subscriptions%ROWTYPE;
  last_nudge TIMESTAMPTZ;
BEGIN
  -- Get user subscription info
  SELECT * INTO user_sub 
  FROM user_subscriptions 
  WHERE user_id = NEW.user_id;
  
  -- Check if user has reached limit
  IF user_sub.usage_count >= user_sub.usage_limit THEN
    -- Check if we've sent a nudge recently (within 24 hours)
    SELECT last_upgrade_nudge INTO last_nudge
    FROM user_subscriptions
    WHERE user_id = NEW.user_id;
    
    -- Send upgrade nudge if not sent recently
    IF last_nudge IS NULL OR last_nudge < NOW() - INTERVAL '24 hours' THEN
      -- Update last nudge time
      UPDATE user_subscriptions 
      SET last_upgrade_nudge = NOW()
      WHERE user_id = NEW.user_id;
      
      -- Send upgrade nudge email
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/send-upgrade-nudge',
        headers := json_build_object(
          'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := json_build_object(
          'email', (SELECT email FROM auth.users WHERE id = NEW.user_id),
          'name', (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = NEW.user_id),
          'usage_count', user_sub.usage_count,
          'usage_limit', user_sub.usage_limit
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Create trigger for usage limit checking
DROP TRIGGER IF EXISTS check_usage_limit_trigger ON messages;
CREATE TRIGGER check_usage_limit_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION check_usage_limit();

-- 14. Create function to send inactivity reminders
CREATE OR REPLACE FUNCTION send_inactivity_reminders()
RETURNS void AS $$
DECLARE
  inactive_user RECORD;
BEGIN
  -- Find users inactive for 7+ days
  FOR inactive_user IN
    SELECT u.id, u.email, u.raw_user_meta_data->>'name' as name, ua.last_activity
    FROM auth.users u
    JOIN user_activity ua ON u.id = ua.user_id
    WHERE ua.last_activity < NOW() - INTERVAL '7 days'
    AND u.email_confirmed_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM email_logs 
      WHERE recipient_user_id = u.id 
      AND flow_type = 'inactivity_reminder' 
      AND sent_at > NOW() - INTERVAL '7 days'
    )
  LOOP
    -- Send inactivity reminder
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-inactivity-reminder',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := json_build_object(
        'email', inactive_user.email,
        'name', inactive_user.name,
        'last_activity', inactive_user.last_activity
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Create function to send weekly summaries
CREATE OR REPLACE FUNCTION send_weekly_summaries()
RETURNS void AS $$
DECLARE
  user_summary RECORD;
BEGIN
  -- Get users with activity in the last week
  FOR user_summary IN
    SELECT 
      u.id,
      u.email,
      u.raw_user_meta_data->>'name' as name,
      COUNT(m.id) as message_count,
      COUNT(DISTINCT m.conversation_id) as conversation_count,
      ARRAY_AGG(DISTINCT m.content->>'text') as recent_messages
    FROM auth.users u
    JOIN user_activity ua ON u.id = ua.user_id
    LEFT JOIN messages m ON u.id = m.user_id 
      AND m.created_at > NOW() - INTERVAL '7 days'
    WHERE u.email_confirmed_at IS NOT NULL
    AND ua.last_activity > NOW() - INTERVAL '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM email_logs 
      WHERE recipient_user_id = u.id 
      AND flow_type = 'weekly_summary' 
      AND sent_at > NOW() - INTERVAL '7 days'
    )
    GROUP BY u.id, u.email, u.raw_user_meta_data->>'name'
    HAVING COUNT(m.id) > 0
  LOOP
    -- Send weekly summary
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-weekly-summary',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := json_build_object(
        'email', user_summary.email,
        'name', user_summary.name,
        'summary_data', json_build_object(
          'messageCount', user_summary.message_count,
          'conversationCount', user_summary.conversation_count,
          'topTopics', ARRAY['AI Development', 'React', 'TypeScript'], -- TODO: Extract from messages
          'insights', ARRAY['You\'re in the top 10% of active users!', 'Your favorite model is Claude'],
          'usageStats', json_build_object(
            'totalMessages', user_summary.message_count,
            'averageResponseTime', 2.3,
            'favoriteModel', 'Claude'
          )
        )
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 16. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_user_id ON email_logs(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_flow_type ON email_logs(flow_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_last_activity ON user_activity(last_activity);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier ON user_subscriptions(tier);

-- 17. Create view for email analytics
CREATE OR REPLACE VIEW email_analytics AS
SELECT 
  flow_type,
  COUNT(*) as total_sent,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  DATE_TRUNC('day', sent_at) as sent_date
FROM email_logs
GROUP BY flow_type, DATE_TRUNC('day', sent_at)
ORDER BY sent_date DESC;

-- 18. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON email_analytics TO anon, authenticated;
GRANT ALL ON email_logs TO service_role;
GRANT ALL ON user_activity TO service_role;
GRANT ALL ON user_subscriptions TO service_role;

-- 19. Set up configuration settings (these need to be set in Supabase dashboard)
-- ALTER SYSTEM SET app.supabase_url = 'https://your-project-ref.supabase.co';
-- ALTER SYSTEM SET app.service_role_key = 'your-service-role-key';

COMMENT ON TABLE email_logs IS 'Tracks all email communications sent to users';
COMMENT ON TABLE user_activity IS 'Tracks user activity for inactivity detection';
COMMENT ON TABLE user_subscriptions IS 'Manages user subscription tiers and usage limits';
COMMENT ON FUNCTION handle_new_user() IS 'Handles new user registration and welcome email';
COMMENT ON FUNCTION check_usage_limit() IS 'Checks usage limits and sends upgrade nudges';
COMMENT ON FUNCTION send_inactivity_reminders() IS 'Sends inactivity reminder emails';
COMMENT ON FUNCTION send_weekly_summaries() IS 'Sends weekly summary emails to active users';
