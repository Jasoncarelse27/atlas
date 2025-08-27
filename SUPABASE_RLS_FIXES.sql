-- =====================================================
-- ATLAS SUPABASE RLS POLICY FIXES - COMPLETE VERSION
-- =====================================================
-- Run these commands in your Supabase SQL Editor
-- This will fix the "Failed to create conversation" errors

-- =====================================================
-- 1. ENABLE RLS ON ALL TABLES
-- =====================================================

-- Enable RLS on conversations table
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Enable RLS on messages table (used by conversationService)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Enable RLS on webhook_logs table (used by hooks)
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. CONVERSATIONS TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can read their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;

-- Policy for users to create their own conversations
CREATE POLICY "Users can create their own conversations" ON conversations
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for users to read their own conversations
CREATE POLICY "Users can read their own conversations" ON conversations
FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to update their own conversations
CREATE POLICY "Users can update their own conversations" ON conversations
FOR UPDATE USING (auth.uid() = user_id);

-- Policy for users to delete their own conversations
CREATE POLICY "Users can delete their own conversations" ON conversations
FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 3. MESSAGES TABLE POLICIES (for conversationService)
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
DROP POLICY IF EXISTS "Users can read their own messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

-- Policy for users to insert their own messages
CREATE POLICY "Users can insert their own messages" ON messages
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for users to read their own messages
CREATE POLICY "Users can read their own messages" ON messages
FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to update their own messages
CREATE POLICY "Users can update their own messages" ON messages
FOR UPDATE USING (auth.uid() = user_id);

-- Policy for users to delete their own messages
CREATE POLICY "Users can delete their own messages" ON messages
FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 4. WEBHOOK_LOGS TABLE POLICIES (for hooks)
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert their own webhook logs" ON webhook_logs;
DROP POLICY IF EXISTS "Users can read their own webhook logs" ON webhook_logs;
DROP POLICY IF EXISTS "Users can update their own webhook logs" ON webhook_logs;
DROP POLICY IF EXISTS "Users can delete their own webhook logs" ON webhook_logs;

-- Policy for users to insert their own webhook logs
CREATE POLICY "Users can insert their own webhook logs" ON webhook_logs
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for users to read their own webhook logs
CREATE POLICY "Users can read their own webhook logs" ON webhook_logs
FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to update their own webhook logs
CREATE POLICY "Users can update their own webhook logs" ON webhook_logs
FOR UPDATE USING (auth.uid() = user_id);

-- Policy for users to delete their own webhook logs
CREATE POLICY "Users can delete their own webhook logs" ON webhook_logs
FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 5. CREATE MISSING TABLES IF THEY DON'T EXIST
-- =====================================================

-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create webhook_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  source TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  role TEXT CHECK (role IN ('user', 'assistant', 'system'))
);

-- Create conversations table if it doesn't exist
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT FALSE,
  pinned BOOLEAN DEFAULT FALSE
);

-- =====================================================
-- 6. CREATE INDEXES FOR BETTER PERFORMANCE
-- =====================================================

-- Indexes for messages table
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Indexes for webhook_logs table
CREATE INDEX IF NOT EXISTS idx_webhook_logs_conversation_id ON webhook_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_user_id ON webhook_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_timestamp ON webhook_logs(timestamp);

-- Indexes for conversations table
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

-- =====================================================
-- 7. VERIFY POLICIES ARE ACTIVE
-- =====================================================

-- Check that RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('conversations', 'messages', 'webhook_logs');

-- Check policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('conversations', 'messages', 'webhook_logs')
ORDER BY tablename, policyname;

-- =====================================================
-- 8. TEST QUERIES (Optional - for verification)
-- =====================================================

-- Test conversation creation (run this after logging in)
-- INSERT INTO conversations (id, user_id, title, created_at, updated_at, pinned)
-- VALUES (gen_random_uuid(), auth.uid(), 'Test Conversation', NOW(), NOW(), false);

-- Test message insertion (run this after creating a conversation)
-- INSERT INTO messages (id, conversation_id, user_id, role, content, created_at)
-- VALUES (gen_random_uuid(), 'conversation_id_here', auth.uid(), 'user', 'Hello Atlas!', NOW());

-- Test webhook log insertion (run this after creating a conversation)
-- INSERT INTO webhook_logs (id, payload, source, timestamp, conversation_id, user_id, role)
-- VALUES (gen_random_uuid(), '{"role": "user", "content": "Hello"}', 'user', NOW(), 'conversation_id_here', auth.uid(), 'user');

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. Run this script in your Supabase SQL Editor
-- 2. Make sure you're logged in as the project owner
-- 3. After running, test conversation creation in your app
-- 4. Check browser console for detailed error logs
-- 5. If issues persist, check that auth.uid() is working properly
-- 6. This script creates both 'messages' and 'webhook_logs' tables
-- 7. Your conversationService uses 'messages' table
-- 8. Your hooks use 'webhook_logs' table
-- 9. Both tables now have proper RLS policies 