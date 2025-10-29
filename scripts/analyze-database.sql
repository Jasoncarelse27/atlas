-- Atlas Database Analysis Script
-- Run this in Supabase Dashboard → SQL Editor
-- Copy results to build optimized migration

-- ========================================
-- ANALYSIS 1: DUPLICATE INDEXES
-- ========================================
-- Finds indexes with identical definitions on the same table

SELECT 
  i1.schemaname,
  i1.tablename,
  i1.indexname AS index_1,
  i2.indexname AS index_2,
  i1.indexdef AS definition,
  pg_size_pretty(pg_relation_size(i1.indexname::regclass)) AS size
FROM pg_indexes i1
JOIN pg_indexes i2 ON 
  i1.schemaname = i2.schemaname
  AND i1.tablename = i2.tablename
  AND i1.indexdef = i2.indexdef
  AND i1.indexname < i2.indexname
WHERE i1.schemaname = 'public'
ORDER BY pg_relation_size(i1.indexname::regclass) DESC;

-- ========================================
-- ANALYSIS 2: UNUSED INDEXES
-- ========================================
-- Finds indexes that have NEVER been used (idx_scan = 0)
-- Requires database to have been running for a while

SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan AS scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexrelname NOT LIKE 'pg_%'
  AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ========================================
-- ANALYSIS 3: UNINDEXED FOREIGN KEYS
-- ========================================
-- Finds foreign keys without a corresponding index
-- This causes slow JOINs and cascading deletes

SELECT 
  c.conrelid::regclass AS table_name,
  c.conname AS constraint_name,
  a.attname AS column_name,
  'Missing index on FK: ' || a.attname AS issue
FROM pg_constraint c
JOIN pg_attribute a ON 
  a.attnum = ANY(c.conkey) 
  AND a.attrelid = c.conrelid
WHERE c.contype = 'f'
  AND c.connamespace = 'public'::regnamespace
  AND NOT EXISTS (
    SELECT 1 
    FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND a.attnum = ANY(i.indkey)
      AND i.indkey[0] = a.attnum
  )
ORDER BY c.conrelid::regclass::text;

-- ========================================
-- ANALYSIS 4: LARGE INDEXES (Storage Optimization)
-- ========================================
-- Shows largest indexes - candidates for optimization

SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan AS times_used,
  idx_tup_read AS rows_read,
  idx_tup_fetch AS rows_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- ========================================
-- ANALYSIS 5: REDUNDANT INDEXES
-- ========================================
-- Finds indexes where one is a prefix of another
-- Example: idx(a) is redundant if idx(a,b) exists

WITH index_cols AS (
  SELECT 
    i.indexrelid,
    i.indrelid,
    idx.indexname,
    idx.tablename,
    ARRAY_AGG(a.attname ORDER BY k.n) AS columns
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_indexes idx ON idx.indexname = c.relname
  CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, n)
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
  WHERE idx.schemaname = 'public'
    AND NOT i.indisprimary
  GROUP BY i.indexrelid, i.indrelid, idx.indexname, idx.tablename
)
SELECT 
  i1.tablename,
  i1.indexname AS redundant_index,
  i1.columns AS redundant_cols,
  i2.indexname AS kept_index,
  i2.columns AS kept_cols,
  pg_size_pretty(pg_relation_size(i1.indexrelid)) AS wasted_space
FROM index_cols i1
JOIN index_cols i2 ON 
  i1.indrelid = i2.indrelid
  AND i1.indexrelid != i2.indexrelid
  AND i1.columns <@ i2.columns
ORDER BY pg_relation_size(i1.indexrelid) DESC;

-- ========================================
-- ANALYSIS 6: INDEX BLOAT (Advanced)
-- ========================================
-- Estimates index bloat (indexes that need REINDEX)

SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  ROUND(100 * (pg_relation_size(indexrelid) - 
    (SELECT reltuples * fillfactor / 100 * 8192 / 1024 / 1024 
     FROM pg_class WHERE oid = indexrelid))::NUMERIC / 
    NULLIF(pg_relation_size(indexrelid), 0), 2) AS bloat_pct
FROM pg_stat_user_indexes
JOIN pg_class ON pg_class.oid = indexrelid
WHERE schemaname = 'public'
  AND pg_relation_size(indexrelid) > 1024 * 1024
ORDER BY bloat_pct DESC NULLS LAST
LIMIT 20;

-- ========================================
-- SUMMARY STATS
-- ========================================

SELECT 
  COUNT(*) AS total_indexes,
  SUM(pg_relation_size(indexrelid)) / 1024 / 1024 AS total_size_mb,
  COUNT(*) FILTER (WHERE idx_scan = 0) AS unused_indexes,
  SUM(pg_relation_size(indexrelid)) FILTER (WHERE idx_scan = 0) / 1024 / 1024 AS unused_size_mb
FROM pg_stat_user_indexes
WHERE schemaname = 'public';

