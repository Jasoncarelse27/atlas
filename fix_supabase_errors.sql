-- Fix 1: Enable pg_cron extension and create the cron job
-- First, enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job for retry failed uploads
SELECT cron.schedule(
  'retry-failed-uploads',
  '*/10 * * * *',
  'SELECT net.http_post(
    url := ''https://rbwabemtucdkytvvpzvk.supabase.co/functions/v1/retryFailedUploads'',
    headers := ''{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid2FiZW10dWNka3l0dnZwenZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM4MTg4NywiZXhwIjoyMDY4OTU3ODg3fQ.iMRXtvfwY37xgEUntYCLdcpoJyqzuOzWnnqo_lIbCAw"}''::jsonb
  );'
);

-- Fix 2: Create the missing trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to the attachments table
DROP TRIGGER IF EXISTS trigger_update_attachments_updated_at ON attachments;
CREATE TRIGGER trigger_update_attachments_updated_at
  BEFORE UPDATE ON attachments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'retry-failed-uploads';

-- Verify the trigger function exists
SELECT proname FROM pg_proc WHERE proname = 'trigger_set_timestamp';
