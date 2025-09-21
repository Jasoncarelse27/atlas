-- Fix daily_usage table schema to match middleware expectations
-- The middleware expects a 'count' column but the table has 'conversations_count'

-- Add a 'count' column that aliases conversations_count for backward compatibility
ALTER TABLE daily_usage 
ADD COLUMN IF NOT EXISTS count INTEGER DEFAULT 0;

-- Update existing records to sync count with conversations_count
UPDATE daily_usage 
SET count = conversations_count 
WHERE count = 0 OR count IS NULL;

-- Create a trigger to keep count in sync with conversations_count
CREATE OR REPLACE FUNCTION sync_daily_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  -- When conversations_count changes, update count to match
  IF NEW.conversations_count != OLD.conversations_count THEN
    NEW.count = NEW.conversations_count;
  END IF;
  
  -- When count changes, update conversations_count to match
  IF NEW.count != OLD.count THEN
    NEW.conversations_count = NEW.count;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to keep both columns in sync
DROP TRIGGER IF EXISTS sync_count_trigger ON daily_usage;
CREATE TRIGGER sync_count_trigger
  BEFORE UPDATE ON daily_usage
  FOR EACH ROW
  EXECUTE FUNCTION sync_daily_usage_count();

-- Grant permissions for the new column
GRANT SELECT, UPDATE ON daily_usage TO authenticated;
GRANT SELECT, UPDATE ON daily_usage TO anon;

-- Update the RLS policies to include the new column
-- (existing policies should already cover this, but being explicit)

COMMENT ON COLUMN daily_usage.count IS 'Message count - kept in sync with conversations_count for middleware compatibility';

