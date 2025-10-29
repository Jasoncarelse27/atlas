# 🔍 DATABASE ANALYSIS - STEP-BY-STEP GUIDE

**Project ID:** `rbwabemtucdkytvvpzvk`

---

## 📋 **OPTION 1: Supabase Dashboard (Recommended - 5 minutes)**

### **Step 1: Open SQL Editor**
1. Go to: https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/sql/new
2. Copy-paste each query below (one at a time)
3. Copy the results back here

---

### **Query 1: Duplicate Indexes** ⚡
```sql
SELECT 
  i1.tablename,
  i1.indexname AS duplicate_index,
  i2.indexname AS original_index,
  pg_size_pretty(pg_relation_size(i1.indexname::regclass)) AS wasted_space
FROM pg_indexes i1
JOIN pg_indexes i2 ON 
  i1.schemaname = i2.schemaname
  AND i1.tablename = i2.tablename
  AND i1.indexdef = i2.indexdef
  AND i1.indexname < i2.indexname
WHERE i1.schemaname = 'public'
ORDER BY pg_relation_size(i1.indexname::regclass) DESC;
```

**Copy results here:** ___________

---

### **Query 2: Unused Indexes** ⚡
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS wasted_space
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
  AND indexrelname NOT LIKE 'pg_%'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;
```

**Copy results here:** ___________

---

### **Query 3: Unindexed Foreign Keys** ⚡
```sql
SELECT 
  c.conrelid::regclass AS table_name,
  c.conname AS fk_constraint,
  a.attname AS column_name,
  pg_size_pretty(pg_relation_size(c.conrelid)) AS table_size
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
ORDER BY pg_relation_size(c.conrelid) DESC;
```

**Copy results here:** ___________

---

### **Query 4: Summary Stats** ⚡
```sql
SELECT 
  COUNT(*) AS total_indexes,
  pg_size_pretty(SUM(pg_relation_size(indexrelid))) AS total_size,
  COUNT(*) FILTER (WHERE idx_scan = 0) AS unused_count,
  pg_size_pretty(SUM(pg_relation_size(indexrelid)) FILTER (WHERE idx_scan = 0)) AS unused_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public';
```

**Copy results here:** ___________

---

## 📋 **OPTION 2: Direct Connection (Faster - 2 minutes)**

### **Get Connection String:**
1. Go to: https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/settings/database
2. Find **"Connection string"** section
3. Select **"Connection pooling"** tab
4. Copy the connection string (it looks like: `postgresql://postgres.rbwabemtucdkytvvpzvk:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres`)
5. Replace `[PASSWORD]` with your actual database password

### **Run Analysis:**
```bash
# Set connection string
export DATABASE_URL="postgresql://postgres.rbwabemtucdkytvvpzvk:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

# Run analysis
psql $DATABASE_URL -f scripts/analyze-database.sql > /tmp/atlas-analysis-results.txt

# Show results
cat /tmp/atlas-analysis-results.txt
```

---

## 🎯 **WHAT HAPPENS NEXT:**

Once you provide the results, I will:
1. ✅ Analyze the **actual** duplicate indexes
2. ✅ Identify **confirmed** unused indexes
3. ✅ Find **real** unindexed foreign keys
4. ✅ Build a **data-driven migration** (not guesswork)
5. ✅ Deploy and verify improvements

**This is proper database optimization.** 💪

---

## ⏱️ **Time Estimate:**

- **Dashboard method:** 5 minutes (copy-paste 4 queries)
- **Direct connection:** 2 minutes (one command)

**Your choice!** Which method do you prefer?

