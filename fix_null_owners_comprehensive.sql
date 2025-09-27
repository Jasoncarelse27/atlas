-- Comprehensive fix for NULL owner issue in uploads bucket
-- This script addresses the root cause of HTTP 400 errors

-- Step 1: Update all files with NULL owners to have the correct user ID
UPDATE storage.objects 
SET owner = '65fcb50a-d67d-453e-a405-50c6aef959be'
WHERE bucket_id = 'uploads' 
  AND owner IS NULL;

-- Step 2: Ensure the uploads bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'uploads';

-- Step 3: Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to uploads bucket" ON storage.objects;

-- Step 4: Create clean, working policies
-- Allow users to upload to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own files
CREATE POLICY "Users can view own files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to all files in uploads bucket
CREATE POLICY "Public read access to uploads"
ON storage.objects
FOR SELECT
USING (bucket_id = 'uploads');

-- Step 5: Verify the fix
SELECT 
  COUNT(*) as total_files,
  COUNT(CASE WHEN owner IS NULL THEN 1 END) as null_owners,
  COUNT(CASE WHEN owner = '65fcb50a-d67d-453e-a405-50c6aef959be' THEN 1 END) as correct_owners
FROM storage.objects 
WHERE bucket_id = 'uploads';

-- Step 6: Check bucket status
SELECT id, name, public FROM storage.buckets WHERE id = 'uploads';
