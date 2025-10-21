-- ⚡ SCALABILITY OPTIMIZATION: Composite indexes for 100K+ users
-- Optimizes conversation listing queries

-- Drop old separate indexes (no longer needed with composite)
DROP INDEX IF EXISTS idx_conversations_user_id;
DROP INDEX IF EXISTS idx_conversations_updated_at;

-- Composite index: user_id + updated_at (most efficient for listing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_user_updated 
ON conversations(user_id, updated_at DESC NULLS LAST) 
WHERE deleted_at IS NULL;

-- Covering index: Includes frequently selected columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_listing 
ON conversations(user_id, updated_at DESC) 
INCLUDE (title, created_at)
WHERE deleted_at IS NULL;

-- Partial index for recent conversations (90% of queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_recent 
ON conversations(user_id, updated_at DESC) 
WHERE deleted_at IS NULL 
AND updated_at > NOW() - INTERVAL '30 days';

-- Messages optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Analyze tables for query planner
ANALYZE conversations;
ANALYZE messages;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Scalability indexes created successfully';
END $$;

