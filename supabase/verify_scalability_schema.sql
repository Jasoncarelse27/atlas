-- =====================================================
-- ATLAS SCALABILITY SCHEMA VERIFICATION
-- Run this in Supabase SQL Editor to verify:
-- 1. Scalability indexes exist
-- 2. Messages table partitioning status
-- 3. Message indexes
-- =====================================================

-- =====================================================
-- PART 1: Verify Scalability Indexes (20251021_scalability_indexes.sql)
-- =====================================================

SELECT 
  '=== SCALABILITY INDEXES ===' AS section;

SELECT 
  i.indexname,
  CASE 
    WHEN i.indexname = 'idx_conversations_user_updated' THEN '✅ Composite index (user_id, updated_at)'
    WHEN i.indexname = 'idx_conversations_listing' THEN '✅ Covering index (includes title, created_at)'
    WHEN i.indexname = 'idx_conversations_recent' THEN '✅ Partial index (30 days)'
    WHEN i.indexname = 'idx_messages_conversation_created' THEN '✅ Messages composite index'
    ELSE '⚠️ Unexpected index'
  END AS status,
  COALESCE(
    pg_size_pretty(pg_relation_size(s.indexrelid)),
    'Size unknown'
  ) as size,
  i.indexdef
FROM pg_indexes i
LEFT JOIN pg_stat_user_indexes s ON 
  s.schemaname = i.schemaname 
  AND s.indexrelname = i.indexname
WHERE i.schemaname = 'public'
  AND (
    i.indexname IN (
      'idx_conversations_user_updated',
      'idx_conversations_listing',
      'idx_conversations_recent',
      'idx_messages_conversation_created'
    )
  )
ORDER BY i.indexname;

-- Check if any are missing
SELECT 
  '=== MISSING INDEXES CHECK ===' AS section;

SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_conversations_user_updated'
    ) THEN '❌ MISSING: idx_conversations_user_updated'
    ELSE '✅ idx_conversations_user_updated exists'
  END AS idx_conversations_user_updated,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_conversations_listing'
    ) THEN '❌ MISSING: idx_conversations_listing'
    ELSE '✅ idx_conversations_listing exists'
  END AS idx_conversations_listing,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_conversations_recent'
    ) THEN '❌ MISSING: idx_conversations_recent'
    ELSE '✅ idx_conversations_recent exists'
  END AS idx_conversations_recent,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_messages_conversation_created'
    ) THEN '❌ MISSING: idx_messages_conversation_created'
    ELSE '✅ idx_messages_conversation_created exists'
  END AS idx_messages_conversation_created;

-- =====================================================
-- PART 2: Verify Messages Table Partitioning
-- =====================================================

SELECT 
  '=== MESSAGES TABLE TYPE ===' AS section;

-- Check if messages table is partitioned (check parent table)
SELECT 
  c.relname AS table_name,
  CASE 
    WHEN c.relkind = 'p' THEN '✅ Partitioned Table (parent)'
    WHEN EXISTS (
      SELECT 1 FROM pg_inherits i
      JOIN pg_class pc ON pc.oid = i.inhparent
      WHERE pc.relname = 'messages'
    ) THEN '✅ Partitioned Table (has partitions)'
    WHEN c.relkind = 'r' THEN '⚠️ Regular Table (NOT partitioned)'
    ELSE '❓ Unknown type'
  END AS table_type,
  CASE 
    WHEN c.relkind = 'p' THEN 'Partitioning is enabled - good for scalability'
    WHEN EXISTS (
      SELECT 1 FROM pg_inherits i
      JOIN pg_class pc ON pc.oid = i.inhparent
      WHERE pc.relname = 'messages'
    ) THEN 'Partitioning is enabled (has child partitions) - good for scalability'
    WHEN c.relkind = 'r' THEN 'Partitioning NOT enabled - may need migration: 20251019_partition_messages_usage_logs.sql'
    ELSE 'Unknown status'
  END AS recommendation
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'messages'
  AND n.nspname = 'public';

-- =====================================================
-- PART 3: List Message Partitions (if partitioned)
-- =====================================================

SELECT 
  '=== MESSAGE PARTITIONS ===' AS section;

SELECT 
  tablename AS partition_name,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size,
  CASE 
    WHEN pg_total_relation_size('public.'||tablename) = 0 THEN 'Empty partition'
    ELSE 'Has data'
  END AS status
FROM pg_tables
WHERE tablename LIKE 'messages_%'
  AND schemaname = 'public'
ORDER BY tablename;

-- If no partitions found, show message
SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename LIKE 'messages_%' 
      AND schemaname = 'public'
    ) THEN '⚠️ No partitions found - table is NOT partitioned'
    ELSE '✅ Partitions found'
  END AS partition_status;

-- =====================================================
-- PART 4: Verify Messages Indexes
-- =====================================================

SELECT 
  '=== MESSAGES TABLE INDEXES ===' AS section;

SELECT 
  i.indexname,
  CASE 
    WHEN i.indexname = 'idx_messages_conversation_created' THEN '✅ Required scalability index'
    WHEN i.indexname LIKE 'idx_messages_%' THEN '✅ Other message index'
    WHEN i.indexname LIKE '%_pkey' THEN 'Primary key'
    ELSE 'Other index'
  END AS status,
  COALESCE(
    pg_size_pretty(pg_relation_size(s.indexrelid)),
    'Size unknown'
  ) as size,
  i.indexdef
FROM pg_indexes i
LEFT JOIN pg_stat_user_indexes s ON 
  s.schemaname = i.schemaname 
  AND s.indexrelname = i.indexname
WHERE i.tablename = 'messages'
  AND i.schemaname = 'public'
ORDER BY 
  CASE 
    WHEN i.indexname = 'idx_messages_conversation_created' THEN 1
    WHEN i.indexname LIKE 'idx_messages_%' THEN 2
    ELSE 3
  END,
  i.indexname;

-- Check specifically for conversation_id + created_at index
SELECT 
  '=== CRITICAL INDEX CHECK ===' AS section;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'messages'
        AND indexname = 'idx_messages_conversation_created'
    ) THEN '✅ idx_messages_conversation_created EXISTS'
    ELSE '❌ MISSING: idx_messages_conversation_created - Run migration: 20251021_scalability_indexes.sql'
  END AS idx_messages_conversation_created_status;

-- =====================================================
-- PART 5: Summary & Recommendations
-- =====================================================

SELECT 
  '=== SUMMARY & RECOMMENDATIONS ===' AS section;

SELECT 
  (SELECT COUNT(*) FROM pg_indexes 
   WHERE schemaname = 'public' 
   AND indexname IN (
     'idx_conversations_user_updated',
     'idx_conversations_listing',
     'idx_conversations_recent',
     'idx_messages_conversation_created'
   )
  ) AS scalability_indexes_found,
  (SELECT COUNT(*) FROM pg_tables 
   WHERE tablename LIKE 'messages_%' 
   AND schemaname = 'public'
  ) AS message_partitions_found,
  (SELECT CASE 
     WHEN EXISTS (
       SELECT 1 FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relname = 'messages' 
       AND n.nspname = 'public'
       AND c.relkind = 'p'
     ) OR EXISTS (
       SELECT 1 FROM pg_inherits i
       JOIN pg_class pc ON pc.oid = i.inhparent
       JOIN pg_namespace n ON n.oid = pc.relnamespace
       WHERE pc.relname = 'messages'
       AND n.nspname = 'public'
     ) OR EXISTS (
       SELECT 1 FROM pg_tables
       WHERE tablename LIKE 'messages_%'
       AND schemaname = 'public'
       LIMIT 1
     ) THEN 1 ELSE 0
   END
  ) AS messages_is_partitioned,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname IN (
            'idx_conversations_user_updated',
            'idx_conversations_listing',
            'idx_conversations_recent',
            'idx_messages_conversation_created'
          )) = 4 
      AND (
        EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 'messages' 
          AND n.nspname = 'public'
          AND c.relkind = 'p'
        ) OR EXISTS (
          SELECT 1 FROM pg_inherits i
          JOIN pg_class pc ON pc.oid = i.inhparent
          JOIN pg_namespace n ON n.oid = pc.relnamespace
          WHERE pc.relname = 'messages'
          AND n.nspname = 'public'
        ) OR EXISTS (
          SELECT 1 FROM pg_tables
          WHERE tablename LIKE 'messages_%'
          AND schemaname = 'public'
          LIMIT 1
        )
      )
    THEN '✅ READY: All indexes exist, partitioning enabled'
    WHEN (SELECT COUNT(*) FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname IN (
            'idx_conversations_user_updated',
            'idx_conversations_listing',
            'idx_conversations_recent',
            'idx_messages_conversation_created'
          )) = 4
    THEN '⚠️ PARTIAL: Indexes exist but partitioning NOT enabled'
    ELSE '❌ NOT READY: Missing indexes or partitioning'
  END AS overall_status;

