-- Atlas Conversation Memory System
-- Creates tables for persistent conversation history and user memory

-- Enable RLS
ALTER DATABASE postgres SET row_security = on;

-- Conversations table for organizing chat sessions
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

-- Messages table for storing individual chat messages
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Row Level Security (RLS) policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Idempotent policy creation for conversations table
DO $$
BEGIN
  -- Users can view their own conversations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can view their own conversations' 
    AND tablename = 'conversations'
  ) THEN
    CREATE POLICY "Users can view their own conversations" ON conversations
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  -- Users can create their own conversations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can create their own conversations' 
    AND tablename = 'conversations'
  ) THEN
    CREATE POLICY "Users can create their own conversations" ON conversations
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;

  -- Users can update their own conversations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can update their own conversations' 
    AND tablename = 'conversations'
  ) THEN
    CREATE POLICY "Users can update their own conversations" ON conversations
      FOR UPDATE USING (user_id = auth.uid());
  END IF;

  -- Users can delete their own conversations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can delete their own conversations' 
    AND tablename = 'conversations'
  ) THEN
    CREATE POLICY "Users can delete their own conversations" ON conversations
      FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- Idempotent policy creation for messages table
DO $$
BEGIN
  -- Users can view messages from their conversations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can view messages from their conversations' 
    AND tablename = 'messages'
  ) THEN
    CREATE POLICY "Users can view messages from their conversations" ON messages
      FOR SELECT USING (
        conversation_id IN (
          SELECT id FROM conversations WHERE user_id = auth.uid()
        )
      );
  END IF;

  -- Users can create messages in their conversations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can create messages in their conversations' 
    AND tablename = 'messages'
  ) THEN
    CREATE POLICY "Users can create messages in their conversations" ON messages
      FOR INSERT WITH CHECK (
        conversation_id IN (
          SELECT id FROM conversations WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

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

-- Grant permissions for service role
GRANT ALL ON conversations TO service_role;
GRANT ALL ON messages TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
