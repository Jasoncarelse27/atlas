-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the Edge Function to run every 10 minutes
SELECT cron.schedule(
  'retry-failed-uploads',
  '*/10 * * * *',
  'SELECT net.http_post(
    url := ''https://rbwabemtucdkytvvpzvk.supabase.co/functions/v1/retryFailedUploads'',
    headers := ''{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}''::jsonb
  );'
);

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'retry-failed-uploads';
