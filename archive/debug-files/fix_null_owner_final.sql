-- Final fix for NULL owner issue
-- This will identify and fix the exact file with NULL owner

-- 1. Find the exact file with NULL owner
SELECT 
  name,
  owner,
  bucket_id,
  created_at
FROM storage.objects 
WHERE bucket_id = 'uploads' 
AND owner IS NULL
ORDER BY created_at DESC;

-- 2. Fix the NULL owner (using LIKE to match the filename pattern)
UPDATE storage.objects 
SET owner = '65fcb50a-d67d-453e-a405-50c6aef959be'
WHERE bucket_id = 'uploads' 
AND owner IS NULL
AND name LIKE '65fcb50a-d67d-453e-a405-50c6aef959be/1758955751344-atlas-logo%';

-- 3. Verify the fix
SELECT 
  name,
  owner,
  bucket_id,
  created_at
FROM storage.objects 
WHERE bucket_id = 'uploads' 
AND name LIKE '65fcb50a-d67d-453e-a405-50c6aef959be/1758955751344-atlas-logo%';

-- 4. Check if there are any remaining NULL owners
SELECT 
  COUNT(*) as remaining_null_owners
FROM storage.objects 
WHERE bucket_id = 'uploads' 
AND owner IS NULL;

-- 5. Test the public URL (should now work)
-- https://rbwabemtucdkytvvpzvk.supabase.co/storage/v1/object/public/uploads/65fcb50a-d67d-453e-a405-50c6aef959be/1758955751344-atlas-logo(social%20media).jpg
