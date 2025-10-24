-- Phase 2: Message Deletion Support
-- Add deleted_at and deleted_by columns to messages table

-- Add deleted_at column (soft delete timestamp)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_by column ('user' or 'everyone')
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS deleted_by TEXT CHECK (deleted_by IN ('user', 'everyone'));

-- Add index for fast filtering of non-deleted messages
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at_filter
ON public.messages (deleted_at) 
WHERE deleted_at IS NULL;

-- Add composite index for user + deleted status (for queries)
CREATE INDEX IF NOT EXISTS idx_messages_user_deleted
ON public.messages (user_id, deleted_at);

-- Update RLS policies to filter deleted messages
-- (Optional: only show non-deleted messages by default)
-- DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
-- CREATE POLICY "Users can view their own messages"
--   ON public.messages FOR SELECT
--   TO authenticated
--   USING (
--     user_id = auth.uid()
--     AND deleted_at IS NULL  -- ✅ Only show non-deleted messages
--   );

-- Comment: We're not enforcing deleted_at in RLS yet
-- Users can see their own deleted messages (for "You deleted this message" placeholder)
-- In the future, we can add deleted_by-based filtering if needed

