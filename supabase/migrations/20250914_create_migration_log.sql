-- Migration Log Table for Audit Trail
-- Date: 2025-09-14
-- Purpose: Track all database migrations and rollbacks

-- Create migration log table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.migration_log (
    id SERIAL PRIMARY KEY,
    migration_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('forward', 'rollback')),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_by TEXT DEFAULT current_user,
    environment TEXT DEFAULT 'unknown',
    notes TEXT
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_migration_log_migration_name ON public.migration_log(migration_name);
CREATE INDEX IF NOT EXISTS idx_migration_log_executed_at ON public.migration_log(executed_at);

-- Add comment for documentation
COMMENT ON TABLE public.migration_log IS 'Audit trail for database migrations and rollbacks';
COMMENT ON COLUMN public.migration_log.migration_name IS 'Name of the migration (e.g., 20250914_subscription_columns)';
COMMENT ON COLUMN public.migration_log.action IS 'Action performed: forward or rollback';
COMMENT ON COLUMN public.migration_log.executed_at IS 'When the migration was executed';
COMMENT ON COLUMN public.migration_log.executed_by IS 'Who executed the migration';
COMMENT ON COLUMN public.migration_log.environment IS 'Environment where migration was executed';

-- Insert initial log entry for this migration
INSERT INTO public.migration_log (migration_name, action, environment, notes) 
VALUES ('20250914_subscription_columns', 'forward', 'migration_setup', 'Migration log table created')
ON CONFLICT DO NOTHING;
