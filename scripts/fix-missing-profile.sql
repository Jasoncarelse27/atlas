-- ============================================
-- Fix Missing Profile for User
-- Creates profile for user: 20ec1aba-67cd-4b33-ad02-5950b5f6f6f6
-- ============================================

-- Step 1: Create the missing profile
INSERT INTO profiles (
  id, 
  email, 
  subscription_tier, 
  subscription_status,
  created_at,
  updated_at
)
SELECT 
  u.id,
  u.email,
  'free',
  'active',
  u.created_at,
  NOW()
FROM auth.users u
WHERE u.id = '20ec1aba-67cd-4b33-ad02-5950b5f6f6f6'
  AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = u.id
  )
ON CONFLICT (id) DO NOTHING;

-- Step 2: Self-heal ALL missing profiles (safe to run)
INSERT INTO profiles (id, email, subscription_tier, subscription_status, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  'free',
  'active',
  u.created_at,
  NOW()
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 3: Verify the fix worked
SELECT 
  'Profile Status' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles p
      INNER JOIN auth.users u ON p.id = u.id
      WHERE p.id = '20ec1aba-67cd-4b33-ad02-5950b5f6f6f6'
    )
    THEN '✅ PROFILE CREATED: User now has profile'
    ELSE '❌ PROFILE STILL MISSING: Check for errors above'
  END as status;

-- Step 4: Show the fixed profile
SELECT 
  p.id,
  p.email,
  p.subscription_tier,
  p.subscription_status,
  p.created_at,
  u.email as auth_email,
  u.created_at as auth_created_at
FROM profiles p
INNER JOIN auth.users u ON p.id = u.id
WHERE p.id = '20ec1aba-67cd-4b33-ad02-5950b5f6f6f6';

-- Step 5: Count any remaining orphaned users
SELECT 
  'Remaining Orphaned Users' as check_type,
  COUNT(*) as count
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;




