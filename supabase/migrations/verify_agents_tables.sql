-- ✅ VERIFICATION SCRIPT for Agents Dashboard Tables
-- Run this in Supabase SQL Editor to verify tables exist and are configured correctly

\echo '==================================================='
\echo '🔍 AGENTS DASHBOARD TABLES - VERIFICATION SCRIPT'
\echo '==================================================='
\echo ''

-- 1. Check if tables exist
\echo '📊 1. Checking if tables exist...'
SELECT 
  tablename,
  CASE 
    WHEN tablename IN ('notifications', 'business_notes', 'memory_auto_summaries') THEN '✅ EXISTS'
    ELSE '⚠️  UNEXPECTED'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('notifications', 'business_notes', 'memory_auto_summaries')
ORDER BY tablename;

\echo ''
\echo '📊 2. Checking RLS status...'
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS ENABLED'
    ELSE '❌ RLS DISABLED'
  END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename IN ('notifications', 'business_notes', 'memory_auto_summaries')
ORDER BY tablename;

\echo ''
\echo '📊 3. Checking RLS policies...'
SELECT 
  tablename,
  policyname,
  CASE 
    WHEN cmd = 'SELECT' THEN '📖 SELECT'
    WHEN cmd = 'INSERT' THEN '➕ INSERT'
    WHEN cmd = 'UPDATE' THEN '✏️  UPDATE'
    WHEN cmd = 'DELETE' THEN '🗑️  DELETE'
    ELSE cmd::text
  END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('notifications', 'business_notes', 'memory_auto_summaries')
ORDER BY tablename, policyname;

\echo ''
\echo '📊 4. Checking indexes...'
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('notifications', 'business_notes', 'memory_auto_summaries')
ORDER BY tablename, indexname;

\echo ''
\echo '📊 5. Checking table columns...'
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('notifications', 'business_notes', 'memory_auto_summaries')
ORDER BY table_name, ordinal_position;

\echo ''
\echo '==================================================='
\echo '✅ VERIFICATION COMPLETE'
\echo ''
\echo 'Expected results:'
\echo '- All 3 tables should exist'
\echo '- All tables should have RLS enabled'
\echo '- notifications: 2 policies (SELECT, UPDATE)'
\echo '- business_notes: 4 policies (SELECT, INSERT, UPDATE, DELETE)'
\echo '- memory_auto_summaries: 2 policies (SELECT, UPDATE)'
\echo '- notifications: 2 indexes'
\echo '- business_notes: 1 index'
\echo '==================================================='

