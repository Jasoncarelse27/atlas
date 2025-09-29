-- Fix 403 errors for assistant message inserts
-- The issue: RLS policy requires user_id but assistant messages don't have it
-- Solution: Allow assistant messages to be inserted without user_id restriction

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can manage their own messages" ON messages;

-- Create a more flexible policy that allows assistant messages
CREATE POLICY "allow_message_operations"
ON messages FOR ALL
TO authenticated
USING (
  -- Allow access if user owns the message OR if it's an assistant message in their conversation
  auth.uid() = user_id 
  OR 
  (
    role = 'assistant' 
    AND conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  -- Allow inserts if user owns the message OR if it's an assistant message in their conversation
  auth.uid() = user_id 
  OR 
  (
    role = 'assistant' 
    AND conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  )
);

-- Add helpful comment
COMMENT ON POLICY "allow_message_operations" ON messages IS 'Allows users to manage their own messages and assistant messages in their conversations';
