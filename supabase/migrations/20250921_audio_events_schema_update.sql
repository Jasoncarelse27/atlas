-- Update audio_events table schema for STT integration
-- Created: September 21, 2025

-- Add new columns to audio_events table
ALTER TABLE public.audio_events 
ADD COLUMN IF NOT EXISTS event_type text,
ADD COLUMN IF NOT EXISTS session_id uuid,
ADD COLUMN IF NOT EXISTS tier text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Create index on event_type for better query performance
CREATE INDEX IF NOT EXISTS idx_audio_events_event_type ON public.audio_events(event_type);

-- Create index on session_id for session tracking
CREATE INDEX IF NOT EXISTS idx_audio_events_session_id ON public.audio_events(session_id);

-- Create index on tier for tier-based analytics
CREATE INDEX IF NOT EXISTS idx_audio_events_tier_new ON public.audio_events(tier);

-- Update existing rows to set default values
UPDATE public.audio_events 
SET event_type = COALESCE(event_name, 'unknown'),
    tier = COALESCE(props->>'tier', 'free'),
    metadata = COALESCE(props, '{}'::jsonb)
WHERE event_type IS NULL OR tier IS NULL;

-- Make event_type NOT NULL after setting defaults
ALTER TABLE public.audio_events ALTER COLUMN event_type SET NOT NULL;

-- Add check constraint for valid event types
ALTER TABLE public.audio_events 
ADD CONSTRAINT check_valid_event_type 
CHECK (event_type IN ('recording_start', 'recording_stop', 'transcription_success', 'transcription_fail', 'tts_start', 'tts_complete'));

-- Add check constraint for valid tiers
ALTER TABLE public.audio_events 
ADD CONSTRAINT check_valid_tier 
CHECK (tier IN ('free', 'core', 'studio'));
