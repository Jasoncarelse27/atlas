-- Add message editing support
-- Adds edited_at column to track when messages are edited
-- Safe additive migration - no data loss, backward compatible

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

COMMENT ON COLUMN messages.edited_at IS 'Timestamp when the message was last edited';

-- Create index for performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_messages_edited_at ON messages (edited_at) WHERE edited_at IS NOT NULL;

-- ✅ This migration is:
-- - Additive only (no data loss)
-- - Backward compatible (nullable column)
-- - Safe to run multiple times (IF NOT EXISTS)
-- - No RLS changes needed (inherits existing policies)

