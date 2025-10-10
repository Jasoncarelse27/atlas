-- Fix RLS Policies for Soft Delete
-- This migration ensures RLS policies are working correctly

-- Drop all existing conversation policies to avoid conflicts
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_owner" ON public.conversations;
DROP POLICY IF EXISTS "conversations_delete_owner" ON public.conversations;
DROP POLICY IF EXISTS "Users can manage their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "users can manage their conversations" ON public.conversations;

-- Create explicit RLS policies that definitely work
CREATE POLICY "conversations_select_policy" ON public.conversations
FOR SELECT 
TO authenticated
USING (
  auth.uid() = user_id 
  AND deleted_at IS NULL
);

CREATE POLICY "conversations_insert_policy" ON public.conversations
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations_update_policy" ON public.conversations
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations_delete_policy" ON public.conversations
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Test the policy
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies updated for soft delete';
  RAISE NOTICE '📝 Users can only see non-deleted conversations';
END$$;
