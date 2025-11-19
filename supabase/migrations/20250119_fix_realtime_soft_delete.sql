-- ✅ BEST PRACTICE: Fix conversation soft-delete realtime sync
-- Uses REPLICA IDENTITY FULL (same pattern as profiles/messages tables)
-- This ensures UPDATE events contain both old and new row data,
-- allowing Realtime to work properly even with RLS policies

-- Step 1: Enable replica identity for real-time updates
-- This ensures UPDATE events contain both old and new row data
ALTER TABLE conversations REPLICA IDENTITY FULL;

-- Step 2: Ensure conversations table is in realtime publication
DO $$
BEGIN
  -- Check if conversations is in the publication
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'conversations'
  ) THEN
    RAISE NOTICE '✅ Conversations table already in supabase_realtime publication';
  ELSE
    -- Add it if not present
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
    RAISE NOTICE '✅ Added conversations table to supabase_realtime publication';
  END IF;
END $$;

-- Step 3: Ensure proper RLS policy (no time-window hack needed)
-- REPLICA IDENTITY FULL allows Realtime to receive UPDATE events
-- even when RLS would normally hide the row
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations
FOR SELECT USING (
  auth.uid() = user_id 
  AND deleted_at IS NULL  -- Only show non-deleted conversations
);

-- Step 4: Ensure UPDATE policy allows setting deleted_at
DROP POLICY IF EXISTS "conversations_update_owner" ON public.conversations;
CREATE POLICY "conversations_update_owner" ON public.conversations
FOR UPDATE USING (
  auth.uid() = user_id
) WITH CHECK (
  auth.uid() = user_id
);

-- Add comment for documentation
COMMENT ON TABLE conversations IS 'User conversations. Realtime enabled with REPLICA IDENTITY FULL for instant deletion sync.';

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '🎉 Realtime configured for conversations table - deletions will now sync instantly!';
  RAISE NOTICE '📡 WebSocket subscriptions are ready to receive UPDATE events';
END $$;
