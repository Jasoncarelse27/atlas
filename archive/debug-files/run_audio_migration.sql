-- =====================================================
-- AUDIO EVENTS TABLE MIGRATION
-- Copy and paste this into Supabase SQL Editor
-- =====================================================

-- Create audio_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.audio_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  event_name text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc', now())
);

-- Enable Row-Level Security
ALTER TABLE public.audio_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (ignore errors)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can insert their own audio events" ON public.audio_events;
    DROP POLICY IF EXISTS "Users can view their own audio events" ON public.audio_events;
EXCEPTION
    WHEN undefined_object THEN
        -- Policy doesn't exist, continue
        NULL;
END $$;

-- Create RLS Policies
CREATE POLICY "Users can insert their own audio events"
  ON public.audio_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own audio events"
  ON public.audio_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audio_events_created_at ON public.audio_events(created_at);
CREATE INDEX IF NOT EXISTS idx_audio_events_user_id ON public.audio_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_events_event_name ON public.audio_events(event_name);
CREATE INDEX IF NOT EXISTS idx_audio_events_tier ON public.audio_events((props->>'tier'));

-- Verify the table was created
SELECT 'Audio events table created successfully' as status;
SELECT count(*) as existing_records FROM public.audio_events;
