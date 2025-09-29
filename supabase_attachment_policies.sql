-- Supabase RLS Policies for Attachment System
-- Run this SQL in your Supabase SQL editor
-- This script handles existing policies gracefully

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can select their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
DROP POLICY IF EXISTS "Users can select their own messages" ON messages;
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Allow inserting own conversations
CREATE POLICY "Users can insert their own conversations"
ON conversations FOR INSERT
WITH CHECK ( auth.uid() = user_id );

-- Allow selecting own conversations
CREATE POLICY "Users can select their own conversations"
ON conversations FOR SELECT
USING ( auth.uid() = user_id );

-- Allow inserting messages tied to user's conversation
CREATE POLICY "Users can insert their own messages"
ON messages FOR INSERT
WITH CHECK ( auth.uid() = user_id );

-- Allow selecting own messages
CREATE POLICY "Users can select their own messages"
ON messages FOR SELECT
USING ( auth.uid() = user_id );

-- Allow users to upload files to their own folder
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Allow users to view their own uploaded files
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING ( bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING ( bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1] );
