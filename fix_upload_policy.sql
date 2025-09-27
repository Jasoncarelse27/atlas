-- Fix upload policy to allow authenticated users to upload
-- This addresses the "Upload failed" issue in the UI

-- Drop existing upload policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;

-- Create a simple, working upload policy
CREATE POLICY "Allow authenticated uploads to uploads bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

-- Verify the policy was created
SELECT policyname, roles
FROM pg_policies
WHERE tablename = 'objects' AND policyname LIKE '%upload%';

-- Test: Check if bucket exists and is public
SELECT id, name, public FROM storage.buckets WHERE id = 'uploads';
