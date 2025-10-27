-- Voice V2 Sessions Table
-- Tracks all voice call sessions with metrics and cost data
-- Created: October 27, 2025

-- Create voice_sessions table
CREATE TABLE IF NOT EXISTS public.voice_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Session identifiers
  session_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  
  -- Session timing
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Session status
  status TEXT NOT NULL DEFAULT 'initializing' 
    CHECK (status IN ('initializing', 'connected', 'listening', 'transcribing', 'thinking', 'speaking', 'ended', 'error')),
  
  -- STT Metrics (Deepgram)
  stt_requests INTEGER DEFAULT 0,
  stt_duration_ms INTEGER DEFAULT 0,
  
  -- LLM Metrics (Claude)
  llm_tokens_input INTEGER DEFAULT 0,
  llm_tokens_output INTEGER DEFAULT 0,
  llm_latency_ms INTEGER DEFAULT 0,
  
  -- TTS Metrics (OpenAI)
  tts_characters INTEGER DEFAULT 0,
  tts_latency_ms INTEGER DEFAULT 0,
  
  -- Total metrics
  total_latency_ms INTEGER DEFAULT 0,
  
  -- Cost tracking
  stt_cost DECIMAL(10, 4) DEFAULT 0,
  llm_cost DECIMAL(10, 4) DEFAULT 0,
  tts_cost DECIMAL(10, 4) DEFAULT 0,
  total_cost DECIMAL(10, 4) DEFAULT 0,
  estimated_cost DECIMAL(10, 4) DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  error_count INTEGER DEFAULT 0,
  
  -- Metadata
  client_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_id 
  ON public.voice_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_conversation_id 
  ON public.voice_sessions(conversation_id);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_created_at 
  ON public.voice_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_session_id 
  ON public.voice_sessions(session_id);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_status 
  ON public.voice_sessions(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_voice_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voice_sessions_updated_at
  BEFORE UPDATE ON public.voice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_sessions_updated_at();

-- Enable Row Level Security
ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own sessions
CREATE POLICY "Users can view own voice sessions"
  ON public.voice_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sessions (server-side)
CREATE POLICY "Users can insert own voice sessions"
  ON public.voice_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions (server-side)
CREATE POLICY "Users can update own voice sessions"
  ON public.voice_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role has full access (for cleanup and admin)
CREATE POLICY "Service role full access"
  ON public.voice_sessions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.voice_sessions TO authenticated;
GRANT ALL ON public.voice_sessions TO service_role;

-- Add comment
COMMENT ON TABLE public.voice_sessions IS 'Tracks Voice V2 WebSocket sessions with metrics, costs, and performance data';

