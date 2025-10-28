-- ✅ VERIFICATION SCRIPT
-- Run this after deploying the security fix migration
-- to verify all issues are resolved

\echo '==================================================='
\echo '🔍 SUPABASE SECURITY ADVISOR - VERIFICATION SCRIPT'
\echo '==================================================='
\echo ''

-- 1. Check RLS is enabled on all public tables
\echo '📊 1. Checking RLS on all public tables...'
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status
FROM pg_tables t
LEFT JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename NOT LIKE '%_old%'
  AND t.tablename NOT LIKE 'pg_%'
ORDER BY rls_status, tablename;

\echo ''
\echo '📊 2. Checking tier_metrics view security...'
-- 2. Verify tier_metrics doesn't expose auth.users
SELECT 
  viewname,
  CASE 
    WHEN definition LIKE '%auth.users%' THEN '❌ EXPOSES auth.users'
    ELSE '✅ SAFE'
  END as security_status
FROM pg_views
WHERE viewname = 'tier_metrics';

\echo ''
\echo '📊 3. Checking function search_path settings...'
-- 3. Verify functions have search_path set
SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.proconfig IS NULL THEN '❌ NO search_path'
    WHEN array_to_string(p.proconfig, ', ') LIKE '%search_path%' THEN '✅ search_path SET'
    ELSE '❌ NO search_path'
  END as security_status,
  array_to_string(p.proconfig, ', ') as config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'pg_%'
ORDER BY security_status, function_name;

\echo ''
\echo '📊 4. Summary of security status...'
-- 4. Summary statistics
SELECT 
  '🔒 Total Public Tables' as metric,
  COUNT(*)::text as value
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE '%_old%'
UNION ALL
SELECT 
  '✅ Tables with RLS Enabled',
  COUNT(*)::text
FROM pg_tables t
LEFT JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename NOT LIKE '%_old%'
  AND c.relrowsecurity = true
UNION ALL
SELECT 
  '🔧 Total Public Functions',
  COUNT(*)::text
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'pg_%'
UNION ALL
SELECT 
  '✅ Functions with search_path',
  COUNT(*)::text
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'pg_%'
  AND p.proconfig IS NOT NULL
  AND array_to_string(p.proconfig, ', ') LIKE '%search_path%';

\echo ''
\echo '==================================================='
\echo '✅ VERIFICATION COMPLETE'
\echo ''
\echo 'Expected results:'
\echo '- All tables should show "✅ ENABLED" for RLS'
\echo '- tier_metrics should show "✅ SAFE"'
\echo '- All functions should show "✅ search_path SET"'
\echo ''
\echo 'If any issues remain, check:'
\echo '1. Migration was run successfully'
\echo '2. No errors during migration execution'
\echo '3. Database role has proper permissions'
\echo '==================================================='

