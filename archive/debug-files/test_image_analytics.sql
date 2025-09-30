-- ============================================
-- Atlas AI - Image Analytics Testing Queries
-- Run these in Supabase SQL Editor to verify analytics
-- ============================================

-- 1. Check all image events (should show events after testing)
SELECT 
  event_name, 
  COUNT(*) as count,
  MAX(created_at) as latest_event
FROM image_events 
GROUP BY event_name 
ORDER BY MAX(created_at) DESC;

-- 2. Check upgrade stats (should increment when Free users click image button)
SELECT 
  feature,
  total_prompts,
  unique_users,
  updated_at
FROM upgrade_stats 
ORDER BY updated_at DESC;

-- 3. Detailed view of recent image events
SELECT 
  user_id,
  event_name,
  file_path,
  file_size,
  metadata,
  created_at
FROM image_events 
ORDER BY created_at DESC 
LIMIT 10;

-- 4. Check storage bucket contents (should show uploaded files)
SELECT 
  name,
  bucket_id,
  owner,
  created_at,
  updated_at
FROM storage.objects 
WHERE bucket_id = 'images'
ORDER BY created_at DESC;

-- 5. Success rate analysis
WITH event_counts AS (
  SELECT 
    event_name,
    COUNT(*) as count
  FROM image_events 
  WHERE created_at > NOW() - INTERVAL '1 hour'
  GROUP BY event_name
)
SELECT 
  'Upload Success Rate' as metric,
  ROUND(
    (SELECT count FROM event_counts WHERE event_name = 'image_upload_complete')::float / 
    NULLIF((SELECT count FROM event_counts WHERE event_name = 'image_upload_start'), 0) * 100, 
    2
  ) as percentage
UNION ALL
SELECT 
  'Upgrade Prompt Count' as metric,
  (SELECT count FROM event_counts WHERE event_name = 'upgrade_prompt_shown')::float as count;
