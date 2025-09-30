-- Fix the latest upload with NULL owner
-- This addresses the persistent issue where new uploads get NULL owners

-- 1. Find the latest file with NULL owner
SELECT 
  name,
  owner,
  bucket_id,
  created_at
FROM storage.objects 
WHERE bucket_id = 'uploads' 
AND owner IS NULL
ORDER BY created_at DESC
LIMIT 1;

-- 2. Fix the latest NULL owner file
UPDATE storage.objects 
SET owner = '65fcb50a-d67d-453e-a405-50c6aef959be'
WHERE bucket_id = 'uploads' 
AND owner IS NULL
AND name LIKE '65fcb50a-d67d-453e-a405-50c6aef959be/1758956440578-atlas-logo%';

-- 3. Verify the fix
SELECT 
  name,
  owner,
  bucket_id,
  created_at
FROM storage.objects 
WHERE bucket_id = 'uploads' 
AND name LIKE '65fcb50a-d67d-453e-a405-50c6aef959be/1758956440578-atlas-logo%';

-- 4. Check remaining NULL owners
SELECT 
  COUNT(*) as remaining_null_owners
FROM storage.objects 
WHERE bucket_id = 'uploads' 
AND owner IS NULL;

-- 5. Test the public URL (should now work)
-- https://rbwabemtucdkytvvpzvk.supabase.co/storage/v1/object/public/uploads/65fcb50a-d67d-453e-a405-50c6aef959be/1758956440578-atlas-logosocial_media.jpg
