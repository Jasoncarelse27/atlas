-- Fix for NULL owner issue in uploads bucket
-- This script addresses the problem where uploaded files have NULL owners

-- 1. First, let's see the current bucket configuration
SELECT 
  id, 
  name, 
  public,
  created_at
FROM storage.buckets 
WHERE id = 'uploads';

-- 2. Check current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage';

-- 3. Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to uploads" ON storage.objects;
DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;

-- 4. Create simple, effective policies for public access
-- Allow anyone to read files from uploads bucket (public access)
CREATE POLICY "Public read access to uploads bucket"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'uploads');

-- Allow authenticated users to upload to uploads bucket
CREATE POLICY "Authenticated users can upload to uploads"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'uploads' 
    AND auth.role() = 'authenticated'
  );

-- Allow users to delete files they uploaded (based on filename pattern)
CREATE POLICY "Users can delete their own uploads"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'uploads' 
    AND auth.role() = 'authenticated'
    AND (
      -- Allow if filename starts with user's UUID
      name LIKE auth.uid()::text || '/%'
      OR
      -- Allow if owner is set to user's UUID
      owner = auth.uid()
    )
  );

-- 5. Update existing files to have proper ownership
-- Set owner to the user ID extracted from the filename
UPDATE storage.objects 
SET owner = (string_to_array(name, '/'))[1]::uuid
WHERE bucket_id = 'uploads' 
AND owner IS NULL 
AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/';

-- 6. Verify the fix
SELECT 
  name,
  bucket_id,
  owner,
  created_at
FROM storage.objects 
WHERE bucket_id = 'uploads'
ORDER BY created_at DESC
LIMIT 5;

-- 7. Test public access by checking bucket policies
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%uploads%';
