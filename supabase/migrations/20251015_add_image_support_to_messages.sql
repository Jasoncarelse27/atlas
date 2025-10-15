-- Add image support to messages table
-- Safe additive migration - no data loss, backward compatible

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN messages.attachments IS 'Array of file metadata (URLs, names, types)';
COMMENT ON COLUMN messages.image_url IS 'Primary image associated with this message';
