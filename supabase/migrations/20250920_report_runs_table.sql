-- ============================
-- Atlas Weekly Reports System - Database Migration
-- Adds report_runs table and storage bucket
-- ============================

-- 1. Report Runs Table
CREATE TABLE IF NOT EXISTS report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  storage_path TEXT,
  email_status TEXT NOT NULL DEFAULT 'pending',
  email_details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_report_runs_period ON report_runs(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_report_runs_created ON report_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_report_runs_status ON report_runs(email_status);

-- Enable RLS
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;

-- Policy for service role access
CREATE POLICY "srv_role_manage_reports" ON report_runs 
FOR ALL USING (auth.role() = 'service_role');

-- 2. Create Storage Bucket for Reports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports', 
  false,
  10485760, -- 10MB limit
  ARRAY['text/csv', 'application/csv']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policy for Reports
CREATE POLICY "srv_role_reports_storage" ON storage.objects
FOR ALL USING (
  bucket_id = 'reports' AND 
  auth.role() = 'service_role'
);

-- Grant permissions
GRANT ALL ON report_runs TO authenticated;

-- ============================
-- Atlas Weekly Reports System Ready!
-- ============================
