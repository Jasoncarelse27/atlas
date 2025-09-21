-- Atlas Audio Analytics Queries
-- Run these in Supabase SQL Editor to verify audio pipeline performance

-- =====================================================
-- 1. AUDIO EVENTS TABLE SETUP (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audio_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  event_name text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc', now())
);

-- Enable Row-Level Security
ALTER TABLE public.audio_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY IF NOT EXISTS "Users can insert their own audio events"
  ON public.audio_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can view their own audio events"
  ON public.audio_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================
-- 2. USAGE BY TIER (last 24h)
-- =====================================================

SELECT 
  props->>'tier' as tier, 
  event_name, 
  count(*) as event_count,
  count(DISTINCT user_id) as unique_users
FROM audio_events
WHERE created_at > now() - interval '24 hours'
GROUP BY 1,2 
ORDER BY 1,2;

-- =====================================================
-- 3. STT SUCCESS RATE
-- =====================================================

WITH stt_events AS (
  SELECT 
    event_name, 
    count(*) as event_count 
  FROM audio_events
  WHERE created_at > now() - interval '24 hours'
    AND event_name IN ('audio_stt_success', 'audio_stt_fail')
  GROUP BY 1
)
SELECT
  (SELECT event_count FROM stt_events WHERE event_name = 'audio_stt_success')::float
  / NULLIF((SELECT SUM(event_count) FROM stt_events), 0) * 100 as stt_success_rate_percent;

-- =====================================================
-- 4. TTS PLAYBACK ANALYSIS
-- =====================================================

SELECT 
  props->>'tier' as tier,
  count(*) as tts_playback_count,
  avg((props->>'chars_input')::int) as avg_chars_per_tts,
  count(DISTINCT user_id) as users_using_tts
FROM audio_events
WHERE event_name = 'audio_tts_playback'
  AND created_at > now() - interval '7 days'
GROUP BY 1 
ORDER BY 2 DESC;

-- =====================================================
-- 5. AUDIO LATENCY ANALYSIS
-- =====================================================

-- TTS Latency (if logged in props)
SELECT 
  AVG((props->>'latency_ms')::int) as avg_tts_latency_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (props->>'latency_ms')::int) as p50_tts_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (props->>'latency_ms')::int) as p95_tts_latency_ms,
  COUNT(*) as total_tts_requests
FROM audio_events
WHERE event_name = 'audio_tts_playback'
  AND created_at > now() - interval '24 hours'
  AND props->>'latency_ms' IS NOT NULL;

-- =====================================================
-- 6. ERROR RATE MONITORING
-- =====================================================

SELECT 
  event_name,
  count(*) as error_count,
  count(DISTINCT user_id) as affected_users
FROM audio_events
WHERE created_at > now() - interval '24 hours'
  AND event_name IN ('audio_stt_fail', 'audio_tts_fail')
GROUP BY 1
ORDER BY 2 DESC;

-- =====================================================
-- 7. TIER CONVERSION ANALYSIS
-- =====================================================

-- Users who used audio features by tier
SELECT 
  props->>'tier' as tier,
  COUNT(DISTINCT user_id) as users_with_audio_usage,
  COUNT(*) as total_audio_events
FROM audio_events
WHERE created_at > now() - interval '7 days'
GROUP BY 1
ORDER BY 2 DESC;

-- =====================================================
-- 8. RECORDING DURATION ANALYSIS
-- =====================================================

-- Average recording duration (if logged)
SELECT 
  AVG((props->>'duration_seconds')::int) as avg_recording_duration_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (props->>'duration_seconds')::int) as median_recording_duration,
  COUNT(*) as total_recordings
FROM audio_events
WHERE event_name = 'audio_record_complete'
  AND created_at > now() - interval '7 days'
  AND props->>'duration_seconds' IS NOT NULL;

-- =====================================================
-- 9. REAL-TIME MONITORING QUERIES
-- =====================================================

-- Current hour audio activity
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  event_name,
  COUNT(*) as event_count
FROM audio_events
WHERE created_at > now() - interval '2 hours'
GROUP BY 1,2
ORDER BY 1 DESC, 2;

-- Audio feature adoption rate
WITH user_activity AS (
  SELECT 
    user_id,
    MAX(CASE WHEN event_name = 'audio_record_start' THEN 1 ELSE 0 END) as has_recorded,
    MAX(CASE WHEN event_name = 'audio_tts_playback' THEN 1 ELSE 0 END) as has_used_tts,
    MAX(CASE WHEN props->>'tier' = 'free' THEN 1 ELSE 0 END) as is_free_user
  FROM audio_events
  WHERE created_at > now() - interval '7 days'
  GROUP BY user_id
)
SELECT 
  COUNT(*) as total_users,
  SUM(has_recorded) as users_who_recorded,
  SUM(has_used_tts) as users_who_used_tts,
  SUM(has_recorded)::float / COUNT(*) * 100 as recording_adoption_rate,
  SUM(has_used_tts)::float / COUNT(*) * 100 as tts_adoption_rate
FROM user_activity;

-- =====================================================
-- 10. ALERT QUERIES (for monitoring)
-- =====================================================

-- High error rate alert (run every 10 minutes)
WITH error_rates AS (
  SELECT 
    COUNT(CASE WHEN event_name IN ('audio_stt_fail', 'audio_tts_fail') THEN 1 END)::float
    / NULLIF(COUNT(*), 0) * 100 as error_rate_percent
  FROM audio_events
  WHERE created_at > now() - interval '10 minutes'
)
SELECT 
  CASE 
    WHEN error_rate_percent > 30 THEN 'ALERT: High audio error rate: ' || error_rate_percent || '%'
    ELSE 'OK: Audio error rate: ' || error_rate_percent || '%'
  END as alert_status
FROM error_rates;

-- =====================================================
-- 11. CLEANUP QUERIES (run periodically)
-- =====================================================

-- Clean up old audio events (keep last 30 days)
-- DELETE FROM audio_events WHERE created_at < now() - interval '30 days';

-- =====================================================
-- 12. PERFORMANCE INDEXES
-- =====================================================

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audio_events_created_at ON audio_events(created_at);
CREATE INDEX IF NOT EXISTS idx_audio_events_user_id ON audio_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_events_event_name ON audio_events(event_name);
CREATE INDEX IF NOT EXISTS idx_audio_events_tier ON audio_events((props->>'tier'));
