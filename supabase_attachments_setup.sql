-- Create attachments bucket if it doesn't exist
-- Run this in your Supabase SQL Editor

-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the attachments bucket
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attachments');

-- Allow authenticated users to view files
CREATE POLICY "Allow authenticated users to view files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'attachments');

-- Allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated users to delete files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'attachments');

-- Allow public access to view files (if needed)
CREATE POLICY "Allow public access to view files" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'attachments');
