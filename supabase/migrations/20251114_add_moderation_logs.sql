-- Add moderation_logs table for content moderation audit trail
-- Created: 2025-11-14
-- Purpose: Track all moderation decisions for compliance and audit

CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_length INTEGER NOT NULL,
  flagged BOOLEAN NOT NULL DEFAULT false,
  blocked BOOLEAN NOT NULL DEFAULT false,
  highest_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  highest_category TEXT,
  category_scores JSONB NOT NULL DEFAULT '{}',
  flagged_categories JSONB NOT NULL DEFAULT '{}',
  moderation_service TEXT NOT NULL DEFAULT 'openai',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user_id ON public.moderation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_flagged ON public.moderation_logs(flagged);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_blocked ON public.moderation_logs(blocked);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON public.moderation_logs(created_at DESC);

-- RLS Policies
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own moderation logs
CREATE POLICY "Users can view own moderation logs"
  ON public.moderation_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert moderation logs (backend only)
CREATE POLICY "Service role can insert moderation logs"
  ON public.moderation_logs
  FOR INSERT
  WITH CHECK (true);

-- Service role can view all moderation logs (for audits)
CREATE POLICY "Service role can view all moderation logs"
  ON public.moderation_logs
  FOR SELECT
  USING (true);

-- Add column documentation
COMMENT ON TABLE public.moderation_logs IS 'Audit trail for content moderation decisions. Tracks all moderation checks for compliance and review.';
COMMENT ON COLUMN public.moderation_logs.flagged IS 'Whether content was flagged by moderation service';
COMMENT ON COLUMN public.moderation_logs.blocked IS 'Whether content was actually blocked (high-confidence violations)';
COMMENT ON COLUMN public.moderation_logs.highest_score IS 'Highest confidence score from moderation service (0-1)';
COMMENT ON COLUMN public.moderation_logs.highest_category IS 'Category with highest confidence score';
COMMENT ON COLUMN public.moderation_logs.category_scores IS 'All category scores from moderation service';
COMMENT ON COLUMN public.moderation_logs.flagged_categories IS 'Categories that were flagged';

