-- Check MailerLite Email Logs
-- Run this in Supabase SQL Editor to see all logged emails

-- Recent email logs (last 10)
SELECT 
  flow_type,
  recipient_email,
  status,
  sent_at,
  metadata->>'event' as event_type,
  metadata->>'campaign_name' as campaign_name,
  metadata->>'automation_name' as automation_name
FROM email_logs
ORDER BY sent_at DESC
LIMIT 10;

-- Summary by flow type
SELECT 
  flow_type,
  status,
  COUNT(*) as count,
  MAX(sent_at) as last_sent
FROM email_logs
GROUP BY flow_type, status
ORDER BY last_sent DESC;

-- Check for welcome emails specifically
SELECT 
  recipient_email,
  status,
  sent_at,
  metadata
FROM email_logs
WHERE flow_type = 'welcome'
ORDER BY sent_at DESC
LIMIT 5;

