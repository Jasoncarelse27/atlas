-- =====================================================
-- Add MailerLite sync to user signup flow
-- Date: November 24, 2025
-- Purpose: Ensure welcome emails are sent by adding users to MailerLite groups
-- =====================================================

-- Create a function to notify backend when a new user is created
-- This will trigger the MailerLite sync
CREATE OR REPLACE FUNCTION public.notify_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  payload json;
BEGIN
  -- Build the payload
  payload = json_build_object(
    'user_id', NEW.id,
    'email', NEW.email,
    'created_at', NEW.created_at
  );
  
  -- Insert a record that backend can poll or use pg_notify for real-time
  -- Option 1: Insert into a queue table (more reliable)
  INSERT INTO public.user_signup_queue (user_id, email, processed, created_at)
  VALUES (NEW.id, NEW.email, false, NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Option 2: Send real-time notification (requires backend listener)
  -- PERFORM pg_notify('user_signup', payload::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the queue table for pending MailerLite syncs
CREATE TABLE IF NOT EXISTS public.user_signup_queue (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Add index for efficient polling
CREATE INDEX IF NOT EXISTS idx_user_signup_queue_unprocessed 
ON public.user_signup_queue (processed, created_at) 
WHERE processed = false;

-- Create trigger to queue MailerLite sync on user creation
DROP TRIGGER IF EXISTS on_auth_user_created_notify ON auth.users;
CREATE TRIGGER on_auth_user_created_notify
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.notify_user_signup();

-- Process any existing users who might not have been synced
INSERT INTO public.user_signup_queue (user_id, email, processed, created_at)
SELECT 
  u.id,
  u.email,
  false,
  u.created_at
FROM auth.users u
LEFT JOIN public.user_signup_queue q ON u.id = q.user_id
WHERE q.user_id IS NULL
  AND u.created_at >= NOW() - INTERVAL '7 days'; -- Only process recent signups

-- Grant access to service role
GRANT ALL ON public.user_signup_queue TO service_role;
GRANT USAGE ON SEQUENCE user_signup_queue_id_seq TO service_role;
