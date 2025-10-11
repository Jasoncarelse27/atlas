-- Enable realtime for messages table
-- REQUIRED for Supabase to send INSERT/UPDATE/DELETE events

ALTER TABLE messages REPLICA IDENTITY FULL;

-- Verify it worked
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'messages'
      AND n.nspname = 'public'
      AND c.relreplident = 'f'  -- 'f' means FULL
  ) THEN
    RAISE EXCEPTION 'REPLICA IDENTITY FULL not set on messages table';
  END IF;
END $$;
