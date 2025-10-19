-- Ensure Realtime is Properly Configured for Profiles Table
-- This allows instant tier updates via WebSocket without page reloads

-- Enable replica identity for real-time updates
-- This ensures UPDATE events contain both old and new row data
ALTER TABLE profiles REPLICA IDENTITY FULL;

-- Profiles table is already in supabase_realtime publication (good!)
-- Just ensure it stays there by not dropping it
DO $$
BEGIN
  -- Check if profiles is in the publication
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'profiles'
  ) THEN
    RAISE NOTICE '✅ Profiles table already in supabase_realtime publication';
  ELSE
    -- Add it if not present (shouldn't happen, but safe)
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
    RAISE NOTICE '✅ Added profiles table to supabase_realtime publication';
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE profiles IS 'User profiles with subscription tier. Realtime enabled for instant tier updates.';

-- Optional: Create indexes for faster realtime queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '🎉 Realtime configured for profiles table - tier updates will now be instant!';
  RAISE NOTICE '📡 WebSocket subscriptions are ready to receive tier changes';
END $$;

