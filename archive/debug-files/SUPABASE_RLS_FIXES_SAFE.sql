-- =====================================================
-- ATLAS SUPABASE RLS POLICY FIXES - SAFE VERSION
-- =====================================================
-- This script safely handles existing tables and column differences

-- =====================================================
-- 1. CHECK AND CREATE TABLES SAFELY
-- =====================================================

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

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT DEFAULT 'free',
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  subscription_status TEXT DEFAULT 'active',
  subscription_id TEXT,
  usage_stats JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. ADD MISSING COLUMNS SAFELY
-- =====================================================

-- Add missing columns to conversations table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'created_at') THEN
    ALTER TABLE conversations ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'updated_at') THEN
    ALTER TABLE conversations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'is_archived') THEN
    ALTER TABLE conversations ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'pinned') THEN
    ALTER TABLE conversations ADD COLUMN pinned BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add missing columns to messages table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'created_at') THEN
    ALTER TABLE messages ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'metadata') THEN
    ALTER TABLE messages ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add missing columns to webhook_logs table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_logs' AND column_name = 'timestamp') THEN
    ALTER TABLE webhook_logs ADD COLUMN timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_logs' AND column_name = 'role') THEN
    ALTER TABLE webhook_logs ADD COLUMN role TEXT CHECK (role IN ('user', 'assistant', 'system'));
  END IF;
END $$;

-- =====================================================
-- 3. ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. DROP EXISTING POLICIES (IF ANY)
-- =====================================================

-- Drop existing policies for conversations
DROP POLICY IF EXISTS "Users can create their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can read their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;

-- Drop existing policies for messages
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
DROP POLICY IF EXISTS "Users can read their own messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

-- Drop existing policies for webhook_logs
DROP POLICY IF EXISTS "Users can insert their own webhook logs" ON webhook_logs;
DROP POLICY IF EXISTS "Users can read their own webhook logs" ON webhook_logs;
DROP POLICY IF EXISTS "Users can update their own webhook logs" ON webhook_logs;
DROP POLICY IF EXISTS "Users can delete their own webhook logs" ON webhook_logs;

-- Drop existing policies for user_profiles
DROP POLICY IF EXISTS "Users can read their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

-- =====================================================
-- 5. CREATE NEW POLICIES
-- =====================================================

-- Conversations policies
CREATE POLICY "Users can create their own conversations" ON conversations
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own conversations" ON conversations
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON conversations
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON conversations
FOR DELETE USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can insert their own messages" ON messages
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own messages" ON messages
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON messages
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" ON messages
FOR DELETE USING (auth.uid() = user_id);

-- Webhook logs policies
CREATE POLICY "Users can insert their own webhook logs" ON webhook_logs
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own webhook logs" ON webhook_logs
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhook logs" ON webhook_logs
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhook logs" ON webhook_logs
FOR DELETE USING (auth.uid() = user_id);

-- User profiles policies
CREATE POLICY "Users can read their own profile" ON user_profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
FOR UPDATE USING (auth.uid() = id);

-- =====================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for conversations table
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

-- Indexes for messages table
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Indexes for webhook_logs table
CREATE INDEX IF NOT EXISTS idx_webhook_logs_conversation_id ON webhook_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_user_id ON webhook_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_timestamp ON webhook_logs(timestamp);

-- =====================================================
-- 7. VERIFY SETUP
-- =====================================================

-- Check that RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('conversations', 'messages', 'webhook_logs', 'user_profiles');

-- Check policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('conversations', 'messages', 'webhook_logs', 'user_profiles')
ORDER BY tablename, policyname;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT '✅ Atlas database setup completed successfully!' as status;
