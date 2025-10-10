-- Test RLS Policies for Soft Delete
-- Run this in Supabase SQL Editor to test if RLS is working

-- 1. Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'conversations';

-- 2. Check current policies
SELECT policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'conversations';

-- 3. Test the select policy (should only return non-deleted conversations)
SELECT id, title, deleted_at 
FROM conversations 
WHERE user_id = auth.uid()
ORDER BY updated_at DESC;

-- 4. Test if we can see deleted conversations (should return 0 rows if RLS is working)
SELECT COUNT(*) as deleted_count
FROM conversations 
WHERE user_id = auth.uid() 
AND deleted_at IS NOT NULL;
