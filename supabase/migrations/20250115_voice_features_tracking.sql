-- Add TTS and voice tracking fields to profiles.usage_stats
-- This is additive - no breaking changes to existing schema

COMMENT ON COLUMN profiles.usage_stats IS 'JSONB tracking: {
  audio_minutes_used: number,
  tts_characters_used: number,
  voice_calls_count: number,
  voice_notes_count: number,
  last_daily_audio_reset: timestamp,
  estimated_cost_this_month: number
}';

-- Create audio_cache table for TTS audio caching (30% cost savings)
CREATE TABLE IF NOT EXISTS audio_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text_hash TEXT NOT NULL UNIQUE,
  text_content TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  model TEXT NOT NULL,
  voice TEXT NOT NULL,
  character_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_audio_cache_expires ON audio_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_audio_cache_hash ON audio_cache(text_hash);

-- RLS policies for audio_cache (public read, system write)
ALTER TABLE audio_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audio cache is readable by all authenticated users"
  ON audio_cache FOR SELECT
  TO authenticated
  USING (true);

-- Cleanup function for expired cache entries
CREATE OR REPLACE FUNCTION cleanup_audio_cache()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM audio_cache WHERE expires_at < NOW();
END;
$$;

