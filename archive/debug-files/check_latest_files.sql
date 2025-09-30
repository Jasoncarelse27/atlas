-- Check latest files in uploads bucket
SELECT
  id,
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