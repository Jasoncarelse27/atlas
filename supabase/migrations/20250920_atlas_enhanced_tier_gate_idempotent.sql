-- ================================
-- Atlas Enhanced Tier Gate Schema (Idempotent)
-- Safe to run multiple times - no "already exists" errors
-- ================================

-- 1. Prompt Cache (system prompt caching)
CREATE TABLE IF NOT EXISTS prompt_cache (
  id BIGSERIAL PRIMARY KEY,
  hash TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  tokens INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 2. Conversations (user chat sessions)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Add foreign key constraint (user_id should reference profiles.id)
  CONSTRAINT fk_conversations_user_id 
    FOREIGN KEY (user_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE
);

-- 3. Messages (individual chat messages)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key to conversations
  CONSTRAINT fk_messages_conversation_id 
    FOREIGN KEY (conversation_id) 
    REFERENCES conversations(id) 
    ON DELETE CASCADE
);

-- ================================
-- Performance Indexes (Idempotent)
-- ================================

CREATE INDEX IF NOT EXISTS idx_prompt_cache_hash ON prompt_cache(hash);
CREATE INDEX IF NOT EXISTS idx_prompt_cache_expires_at ON prompt_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ================================
-- Idempotent RLS + Policies
-- ================================

-- Enable RLS safely
ALTER TABLE prompt_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Prompt Cache Policy (Service Role Access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'srv role manage prompt_cache' 
    AND tablename = 'prompt_cache'
  ) THEN
    CREATE POLICY "srv role manage prompt_cache"
    ON prompt_cache
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Conversations Policy (User Access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'users can manage their conversations' 
    AND tablename = 'conversations'
  ) THEN
    CREATE POLICY "users can manage their conversations"
    ON conversations
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Messages Policy (User Access via Conversations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'users can manage their messages' 
    AND tablename = 'messages'
  ) THEN
    CREATE POLICY "users can manage their messages"
    ON messages
    FOR ALL
    TO authenticated
    USING (
      auth.uid() IN (
        SELECT user_id FROM conversations WHERE id = conversation_id
      )
    )
    WITH CHECK (
      auth.uid() IN (
        SELECT user_id FROM conversations WHERE id = conversation_id
      )
    );
  END IF;
END $$;

-- ================================
-- Functions and Triggers (Idempotent)
-- ================================

-- Function to auto-update conversation updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations 
  SET updated_at = NOW() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation timestamp when messages are added
DROP TRIGGER IF EXISTS trigger_update_conversation_updated_at ON messages;
CREATE TRIGGER trigger_update_conversation_updated_at
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_updated_at();

-- ================================
-- Role Grants (Idempotent)
-- ================================

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant table permissions
GRANT ALL ON prompt_cache TO service_role;
GRANT ALL ON conversations TO authenticated, service_role;
GRANT ALL ON messages TO authenticated, service_role;

-- Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================
-- Comments for Future Developers
-- ================================

COMMENT ON TABLE prompt_cache IS 'Caches system prompts to reduce API costs and improve response times';
COMMENT ON TABLE conversations IS 'User chat sessions with Atlas - enables conversation memory and history';
COMMENT ON TABLE messages IS 'Individual messages within conversations - stores full chat history';

COMMENT ON COLUMN conversations.title IS 'Auto-generated from first user message, truncated to 50 chars';
COMMENT ON COLUMN messages.role IS 'Message sender: user, assistant, or system';
COMMENT ON COLUMN messages.content IS 'Full message text content';

-- ================================
-- Migration Complete
-- ================================

-- This migration is:
-- ✅ Fully idempotent - safe to run multiple times
-- ✅ Production-ready - proper RLS and permissions
-- ✅ Performance-optimized - all necessary indexes
-- ✅ Memory-enabled - conversations and messages for Atlas AI
-- ✅ Cache-enabled - prompt caching for cost optimization

