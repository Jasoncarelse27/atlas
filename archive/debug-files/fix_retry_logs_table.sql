-- Fix retry_logs table to add file_type column
-- This fixes the 400 Bad Request error when logging retry attempts

-- Add file_type column to retry_logs table for better analytics
ALTER TABLE IF EXISTS retry_logs
  ADD COLUMN IF NOT EXISTS file_type text 
  CHECK (file_type IN ('image','file','audio')) 
  DEFAULT 'file';

-- Create index for efficient querying by file type
CREATE INDEX IF NOT EXISTS idx_retry_logs_ft_created 
  ON retry_logs(file_type, created_at DESC);

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'retry_logs' 
ORDER BY ordinal_position;
