-- Add content_reports table for user reporting mechanism
-- Created: 2025-11-14
-- Purpose: Allow users to report inappropriate content for manual review

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  report_reason TEXT NOT NULL,
  report_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter_id ON public.content_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reported_message_id ON public.content_reports(reported_message_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_created_at ON public.content_reports(created_at DESC);

-- RLS Policies
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports
CREATE POLICY "Users can create reports"
  ON public.content_reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
  ON public.content_reports
  FOR SELECT
  USING (auth.uid() = reporter_id);

-- Service role can manage all reports (for admin review)
CREATE POLICY "Service role can manage all reports"
  ON public.content_reports
  FOR ALL
  USING (true);

-- Add column documentation
COMMENT ON TABLE public.content_reports IS 'User-reported content for manual review. Community-driven moderation mechanism.';
COMMENT ON COLUMN public.content_reports.status IS 'Report status: pending, reviewed, resolved, dismissed';
COMMENT ON COLUMN public.content_reports.report_reason IS 'Reason for report (inappropriate, harassment, spam, etc.)';

