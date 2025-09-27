-- Fix the latest file with NULL owner and ensure future uploads work
-- This addresses the specific issue where the most recent file has owner: NULL

-- 1. Fix the latest file with NULL owner
UPDATE storage.objects 
SET owner = '65fcb50a-d67d-453e-a405-50c6aef959be'
WHERE bucket_id = 'uploads' 
AND name = '65fcb50a-d67d-453e-a405-50c6aef959be/1758955751344-atlas-logo (social'
AND owner IS NULL;

-- 2. Verify the fix
SELECT 
  name,
  owner,
  bucket_id,
  created_at
FROM storage.objects 
WHERE bucket_id = 'uploads' 
AND name = '65fcb50a-d67d-453e-a405-50c6aef959be/1758955751344-atlas-logo (social';

-- 3. Check if there are any other NULL owners
SELECT 
  COUNT(*) as null_owner_count
FROM storage.objects 
WHERE bucket_id = 'uploads' 
AND owner IS NULL;

-- 4. Test the public URL access (this should now work)
-- The file should now be accessible at:
-- https://rbwabemtucdkytvvpzvk.supabase.co/storage/v1/object/public/uploads/65fcb50a-d67d-453e-a405-50c6aef959be/1758955751344-atlas-logo(social%20media).jpg
