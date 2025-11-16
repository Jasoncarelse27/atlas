-- =====================================================
-- ATLAS SCALABILITY INDEXES - STEP BY STEP GUIDE
-- Date: November 16, 2025
-- 
-- IMPORTANT: CREATE INDEX CONCURRENTLY cannot run in transactions
-- Run each CREATE INDEX statement SEPARATELY in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- STEP 1: Drop old indexes (can run together)
-- =====================================================
DROP INDEX IF EXISTS idx_conversations_user_id;
DROP INDEX IF EXISTS idx_conversations_updated_at;

-- =====================================================
-- STEP 2: Create Index 1 - Run this ALONE
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_user_updated 
ON conversations(user_id, updated_at DESC NULLS LAST) 
WHERE deleted_at IS NULL;

-- =====================================================
-- STEP 3: Create Index 2 - Run this ALONE (after Step 2 completes)
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_listing 
ON conversations(user_id, updated_at DESC) 
INCLUDE (title, created_at)
WHERE deleted_at IS NULL;

-- =====================================================
-- STEP 4: Create Index 3 - Run this ALONE (after Step 3 completes)
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_recent 
ON conversations(user_id, updated_at DESC) 
WHERE deleted_at IS NULL 
AND updated_at > NOW() - INTERVAL '30 days';

-- =====================================================
-- STEP 5: Create Index 4 - Run this ALONE (after Step 4 completes)
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC)
WHERE deleted_at IS NULL;

-- =====================================================
-- STEP 6: Analyze tables (can run together, after all indexes)
-- =====================================================
ANALYZE conversations;
ANALYZE messages;

