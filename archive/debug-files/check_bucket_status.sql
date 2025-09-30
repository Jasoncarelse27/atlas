-- Check bucket and file status
-- This will help us understand why images still return 400

-- 1. Check bucket configuration
SELECT 
  id, 
  name, 
  public,
  created_at
FROM storage.buckets 
WHERE id = 'uploads';

-- 2. Check file ownership and status
SELECT 
  name,
  bucket_id,
  owner,
  created_at,
  updated_at,
  metadata
FROM storage.objects 
WHERE bucket_id = 'uploads'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check if RLS is enabled on storage.objects
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'storage' 
AND tablename = 'objects';

-- 4. Check all policies on storage.objects
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects';
