-- 20250109_soft_delete_system.sql
-- Atlas Soft Delete System - Bulletproof Conversation Deletion
-- Adds soft-delete columns, RPC functions, and updated RLS policies

-- ================================
-- 1) Add Soft-Delete Columns
-- ================================

-- Add deleted_at column to conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to messages  
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ================================
-- 2) Create Indexes for Performance
-- ================================

-- Index for fast filtering of non-deleted conversations
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at 
ON public.conversations (deleted_at) 
WHERE deleted_at IS NULL;

-- Index for fast filtering of non-deleted messages
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at 
ON public.messages (deleted_at) 
WHERE deleted_at IS NULL;

-- ================================
-- 3) Ensure FK Cascade (Drop & Recreate if Needed)
-- ================================

DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_conversation_id_fkey'
    AND table_name = 'messages'
  ) THEN
    ALTER TABLE public.messages DROP CONSTRAINT messages_conversation_id_fkey;
  END IF;
  
  -- Add new constraint with CASCADE
  ALTER TABLE public.messages
  ADD CONSTRAINT messages_conversation_id_fkey
  FOREIGN KEY (conversation_id)
  REFERENCES public.conversations(id)
  ON DELETE CASCADE;
END$$;

-- ================================
-- 4) Soft-Delete RPC Functions
-- ================================

-- Soft-delete conversation and its messages
CREATE OR REPLACE FUNCTION public.delete_conversation_soft(
  p_user UUID, 
  p_conversation UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Soft-delete the conversation
  UPDATE public.conversations
  SET deleted_at = NOW()
  WHERE id = p_conversation 
  AND user_id = p_user
  AND deleted_at IS NULL;

  -- Soft-delete all messages in the conversation
  UPDATE public.messages
  SET deleted_at = NOW()
  WHERE conversation_id = p_conversation
  AND deleted_at IS NULL;
END;
$$;

-- Hard-delete conversation (for permanent removal if needed)
CREATE OR REPLACE FUNCTION public.delete_conversation_hard(
  p_user UUID, 
  p_conversation UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Hard delete the conversation (messages will cascade due to FK)
  DELETE FROM public.conversations
  WHERE id = p_conversation 
  AND user_id = p_user;
END;
$$;

-- ================================
-- 5) Update RLS Policies - Only Show Non-Deleted Rows
-- ================================

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can manage their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can manage their own messages" ON public.messages;
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "conversations_update_owner" ON public.conversations;
DROP POLICY IF EXISTS "messages_update_owner" ON public.messages;

-- New conversation policies (only non-deleted)
CREATE POLICY "conversations_select" ON public.conversations
FOR SELECT USING (
  auth.uid() = user_id 
  AND deleted_at IS NULL
);

CREATE POLICY "conversations_insert" ON public.conversations
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations_update_owner" ON public.conversations
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "conversations_delete_owner" ON public.conversations
FOR DELETE USING (auth.uid() = user_id);

-- New message policies (only non-deleted, via non-deleted conversations)
CREATE POLICY "messages_select" ON public.messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND c.user_id = auth.uid()
    AND c.deleted_at IS NULL
  )
  AND deleted_at IS NULL
);

CREATE POLICY "messages_insert" ON public.messages
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND c.user_id = auth.uid()
    AND c.deleted_at IS NULL
  )
);

CREATE POLICY "messages_update_owner" ON public.messages
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "messages_delete_owner" ON public.messages
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND c.user_id = auth.uid()
  )
);

-- ================================
-- 6) Grant Permissions
-- ================================

-- Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION public.delete_conversation_soft(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_conversation_hard(UUID, UUID) TO authenticated;

-- Service role permissions (for admin operations if needed)
GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.messages TO service_role;

-- ================================
-- 7) Add Comments for Documentation
-- ================================

COMMENT ON COLUMN public.conversations.deleted_at IS 'Timestamp when conversation was soft-deleted. NULL means active.';
COMMENT ON COLUMN public.messages.deleted_at IS 'Timestamp when message was soft-deleted. NULL means active.';
COMMENT ON FUNCTION public.delete_conversation_soft(UUID, UUID) IS 'Soft-deletes a conversation and all its messages by setting deleted_at timestamp.';
COMMENT ON FUNCTION public.delete_conversation_hard(UUID, UUID) IS 'Permanently deletes a conversation and all its messages. Cannot be undone.';

-- ================================
-- Success Message
-- ================================

DO $$
BEGIN
  RAISE NOTICE '✅ Atlas Soft Delete System installed successfully!';
  RAISE NOTICE '📝 Conversations and messages now support soft deletion';
  RAISE NOTICE '🔒 RLS policies updated to hide deleted content';
  RAISE NOTICE '🚀 RPC functions available: delete_conversation_soft() and delete_conversation_hard()';
END$$;
