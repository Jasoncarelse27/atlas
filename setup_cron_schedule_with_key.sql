-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the Edge Function to run every 10 minutes
SELECT cron.schedule(
  'retry-failed-uploads',
  '*/10 * * * *',
  'SELECT net.http_post(
    url := ''https://rbwabemtucdkytvvpzvk.supabase.co/functions/v1/retryFailedUploads'',
    headers := ''{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid2FiZW10dWNka3l0dnZwenZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM4MTg4NywiZXhwIjoyMDY4OTU3ODg3fQ.iMRXtvfwY37xgEUntYCLdcpoJyqzuOzWnnqo_lIbCAw", "Content-Type": "application/json"}''::jsonb,
    body := ''{"trigger": "cron"}''::jsonb
  );'
);

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'retry-failed-uploads';
