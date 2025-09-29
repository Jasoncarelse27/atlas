-- 20250929_rls_policies.sql
-- Golden Standard Supabase RLS Policies for Atlas
-- Ensures users can only access their own conversations + messages

-- 🔐 Enable RLS on conversations table
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- 🚀 Allow users to manage their own conversations
DROP POLICY IF EXISTS "Users can manage their own conversations" ON conversations;
CREATE POLICY "Users can manage their own conversations"
ON conversations
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 🔐 Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 🚀 Allow users to manage their own messages
DROP POLICY IF EXISTS "Users can manage their own messages" ON messages;
CREATE POLICY "Users can manage their own messages"
ON messages
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 📦 Optional: read-only for system/admin service role
-- (Keeps analytics + sync jobs working if needed)
DROP POLICY IF EXISTS "Service role full access" ON conversations;
CREATE POLICY "Service role full access"
ON conversations FOR ALL
TO service_role
USING (true);

DROP POLICY IF EXISTS "Service role full access" ON messages;
CREATE POLICY "Service role full access"
ON messages FOR ALL
TO service_role
USING (true);
