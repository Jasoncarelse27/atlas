-- Final comprehensive fix for uploads bucket
-- This handles existing policies and ensures public access

-- 1. Check current bucket status
SELECT 
  id, 
  name, 
  public,
  created_at
FROM storage.buckets 
WHERE id = 'uploads';

-- 2. Make sure the bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'uploads';

-- 3. Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Public read access to uploads bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to uploads" ON storage.objects;
DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;

-- 4. Create simple, effective policies
-- Allow public read access to uploads bucket
CREATE POLICY "uploads_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'uploads');

-- Allow authenticated users to upload
CREATE POLICY "uploads_authenticated_insert"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'uploads' 
    AND auth.role() = 'authenticated'
  );

-- Allow users to delete their own files
CREATE POLICY "uploads_user_delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'uploads' 
    AND auth.role() = 'authenticated'
    AND (
      name LIKE auth.uid()::text || '/%'
      OR owner = auth.uid()
    )
  );

-- 5. Update existing files to have proper ownership
UPDATE storage.objects 
SET owner = (string_to_array(name, '/'))[1]::uuid
WHERE bucket_id = 'uploads' 
AND owner IS NULL 
AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/';

-- 6. Verify the fix
SELECT 
  'Bucket Status' as check_type,
  id, 
  name, 
  public
FROM storage.buckets 
WHERE id = 'uploads'

UNION ALL

SELECT 
  'Policy Count' as check_type,
  COUNT(*)::text as id,
  '' as name,
  NULL as public
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%uploads%'

UNION ALL

SELECT 
  'File Count' as check_type,
  COUNT(*)::text as id,
  '' as name,
  NULL as public
FROM storage.objects 
WHERE bucket_id = 'uploads';
