-- Atlas Message Reactions Migration
-- Adds support for emoji reactions on messages (Phase 1 Quick Win)
-- Industry standard pattern: Slack, Discord, WhatsApp

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '🤔', '🎯', '✅', '🔥', '✨')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One reaction per user per message per emoji
  UNIQUE(message_id, user_id, emoji),
  
  -- Foreign key to messages (cascade delete)
  CONSTRAINT fk_message_reactions_message_id 
    FOREIGN KEY (message_id) 
    REFERENCES messages(id) 
    ON DELETE CASCADE,
  
  -- Foreign key to profiles
  CONSTRAINT fk_message_reactions_user_id 
    FOREIGN KEY (user_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_created_at ON message_reactions(created_at);

-- Enable RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view all reactions (public data)
CREATE POLICY "Users can view all reactions"
  ON message_reactions
  FOR SELECT
  USING (true);

-- Users can add their own reactions
CREATE POLICY "Users can add their own reactions"
  ON message_reactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own reactions
CREATE POLICY "Users can remove their own reactions"
  ON message_reactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE message_reactions IS 'Emoji reactions on messages (Phase 1 Quick Win)';
COMMENT ON COLUMN message_reactions.emoji IS 'Standard emoji reactions: 👍 ❤️ 😂 🤔 🎯 ✅ 🔥 ✨';
COMMENT ON COLUMN message_reactions.message_id IS 'Reference to the message being reacted to';
COMMENT ON COLUMN message_reactions.user_id IS 'User who added the reaction';



