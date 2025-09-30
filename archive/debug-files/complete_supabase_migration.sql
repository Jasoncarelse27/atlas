-- Complete Supabase Migration for Atlas
-- Run this SQL in your Supabase SQL editor
-- This creates all necessary tables and policies

-- 1. Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create messages table  
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  content TEXT,
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS on both tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can select their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
DROP POLICY IF EXISTS "Users can select their own messages" ON messages;
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- 5. Create conversation policies
CREATE POLICY "Users can insert their own conversations"
ON conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own conversations"
ON conversations FOR SELECT
USING (auth.uid() = user_id);

-- 6. Create message policies
CREATE POLICY "Users can insert their own messages"
ON messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own messages"
ON messages FOR SELECT
USING (auth.uid() = user_id);

-- 7. Create storage policies for file uploads
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 8. Create uploads bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- 9. Verify tables exist
SELECT 'conversations' as table_name, count(*) as row_count FROM conversations
UNION ALL
SELECT 'messages' as table_name, count(*) as row_count FROM messages;
