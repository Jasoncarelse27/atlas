-- Check where jasonc.jpg@gmail.com exists in the database
-- Run this in Supabase SQL Editor

-- 1. Check auth.users (authentication table)
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at,
  deleted_at
FROM auth.users
WHERE email = 'jasonc.jpg@gmail.com';

-- 2. Check profiles table (PRODUCTION - this is what backend uses)
SELECT 
  id,
  email,
  subscription_tier,
  subscription_status,
  created_at,
  updated_at
FROM public.profiles
WHERE email = 'jasonc.jpg@gmail.com';

-- 3. Check user_profiles table (LEGACY - may be empty)
SELECT 
  id,
  email,
  subscription_tier,
  subscription_status,
  created_at,
  updated_at
FROM public.user_profiles
WHERE email = 'jasonc.jpg@gmail.com';

-- 4. Check if user exists in auth.users but missing from profiles
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created_at,
  p.id as profile_id,
  up.id as user_profile_id,
  CASE 
    WHEN p.id IS NULL AND up.id IS NULL THEN '❌ Missing from both profile tables'
    WHEN p.id IS NULL THEN '⚠️ Missing from profiles (production)'
    WHEN up.id IS NULL THEN '✅ In profiles only (correct)'
    ELSE '✅ In both tables'
  END as status
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
LEFT JOIN public.user_profiles up ON au.id = up.id
WHERE au.email = 'jasonc.jpg@gmail.com';

-- 5. If user exists in auth.users but not in profiles, create profile
-- UNCOMMENT TO RUN:
/*
INSERT INTO public.profiles (id, email, subscription_tier, subscription_status)
SELECT 
  au.id,
  au.email,
  'free',
  'active'
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE au.email = 'jasonc.jpg@gmail.com'
AND p.id IS NULL
ON CONFLICT (id) DO NOTHING;
*/

