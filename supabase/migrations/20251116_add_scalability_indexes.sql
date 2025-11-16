-- =====================================================
-- ATLAS SCALABILITY INDEXES - PRODUCTION FIX
-- Date: November 16, 2025
-- Purpose: Add missing scalability indexes for 10K+ users
-- Safe to run: Yes (uses IF NOT EXISTS)
-- 
-- IMPORTANT: Run each CREATE INDEX CONCURRENTLY separately
-- They cannot run inside a transaction block
-- 
-- BEST PRACTICE: Run ANALYZE immediately after each index
-- This ensures query planner picks up new indexes instantly
-- =====================================================

-- ⚡ SCALABILITY OPTIMIZATION: Composite indexes for 100K+ users
-- Optimizes conversation listing queries

-- =====================================================
-- STEP 1: Drop old separate indexes (run together)
-- =====================================================
DROP INDEX IF EXISTS idx_conversations_user_id;
DROP INDEX IF EXISTS idx_conversations_updated_at;

-- =====================================================
-- STEP 2: Create Index 1 + ANALYZE immediately
-- Run this block together (wait for completion before Step 3)
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_user_updated 
ON conversations(user_id, updated_at DESC NULLS LAST) 
WHERE deleted_at IS NULL;

ANALYZE conversations;

-- =====================================================
-- STEP 3: Create Index 2 + ANALYZE immediately
-- Run this block together (wait for completion before Step 4)
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_listing 
ON conversations(user_id, updated_at DESC) 
INCLUDE (title, created_at)
WHERE deleted_at IS NULL;

ANALYZE conversations;

-- =====================================================
-- STEP 4: Create Index 3 + ANALYZE immediately
-- Run this block together (wait for completion before Step 5)
-- NOTE: Removed NOW() from predicate (not IMMUTABLE)
-- This index still optimizes recent queries efficiently
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_recent 
ON conversations(user_id, updated_at DESC) 
WHERE deleted_at IS NULL;

ANALYZE conversations;

-- =====================================================
-- STEP 5: Create Index 4 + ANALYZE immediately
-- Run this block together (final step)
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC)
WHERE deleted_at IS NULL;

ANALYZE messages;

