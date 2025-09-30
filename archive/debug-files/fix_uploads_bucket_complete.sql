-- Complete fix for uploads bucket and policies
-- This script will ensure the bucket exists and has proper public access

-- 1. Create the uploads bucket if it doesn't exist (make it public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to uploads" ON storage.objects;
DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON storage.objects;

-- 3. Create comprehensive policies for the uploads bucket
-- Allow public read access to all files in uploads bucket
CREATE POLICY "Public read access to uploads"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'uploads');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'uploads' 
    AND auth.role() = 'authenticated'
  );

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'uploads' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4. Verify the bucket configuration
SELECT 
  id, 
  name, 
  public,
  created_at
FROM storage.buckets 
WHERE id = 'uploads';

-- 5. List any existing files in the bucket
SELECT 
  name,
  bucket_id,
  owner,
  created_at,
  updated_at
FROM storage.objects 
WHERE bucket_id = 'uploads'
ORDER BY created_at DESC
LIMIT 10;
