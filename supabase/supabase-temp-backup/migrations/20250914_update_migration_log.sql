-- Migration: Update migration_log table for enhanced rollback tracking
-- This extends the migration_log table to include environment, reason, and actor information

-- Add new columns for enhanced rollback tracking
ALTER TABLE migration_log
ADD COLUMN IF NOT EXISTS environment TEXT,
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS actor TEXT;

-- Add comments for documentation
COMMENT ON COLUMN migration_log.environment IS 'Environment where migration was executed (staging/production)';
COMMENT ON COLUMN migration_log.reason IS 'Reason for rollback or migration';
COMMENT ON COLUMN migration_log.actor IS 'User or system that executed the migration';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_migration_log_environment ON migration_log(environment);
CREATE INDEX IF NOT EXISTS idx_migration_log_executed_at ON migration_log(executed_at);

-- Insert a sample rollback record for testing
INSERT INTO migration_log (migration_name, operation, environment, reason, actor, executed_at)
VALUES (
  '20250914_update_migration_log',
  'FORWARD',
  'staging',
  'Enhanced rollback tracking setup',
  'migration-system',
  NOW()
) ON CONFLICT DO NOTHING;
