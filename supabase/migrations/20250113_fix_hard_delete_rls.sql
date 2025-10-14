-- 20250113_fix_hard_delete_rls.sql
-- Fix RLS policies for hard delete system (no soft delete)
-- This ensures DELETE events are properly broadcast via real-time

-- ================================
-- 1) Drop ALL conflicting policies
-- ================================

-- Drop all existing conversation policies
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_owner" ON public.conversations;
DROP POLICY IF EXISTS "conversations_delete_owner" ON public.conversations;
DROP POLICY IF EXISTS "Users can manage their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can select their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "conversations_select_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_delete_policy" ON public.conversations;

-- Drop all existing message policies
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update_owner" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_owner" ON public.messages;
DROP POLICY IF EXISTS "Users can manage their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.messages;

-- ================================
-- 2) Create SIMPLE, CLEAN policies for hard delete
-- ================================

-- Simple conversation policies (NO deleted_at filtering)
CREATE POLICY "conversations_all_operations" ON public.conversations
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Simple message policies (NO deleted_at filtering)
CREATE POLICY "messages_all_operations" ON public.messages
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Service role always has full access
CREATE POLICY "conversations_service_role" ON public.conversations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "messages_service_role" ON public.messages
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ================================
-- 3) Verify policies are working
-- ================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies updated for hard delete system';
  RAISE NOTICE '📝 DELETE events will now broadcast via real-time';
  RAISE NOTICE '🔓 No deleted_at filtering - clean hard delete only';
END$$;


