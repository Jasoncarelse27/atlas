-- ==========================================================
-- Atlas Billing Periods Table Migration
-- ==========================================================
-- Purpose: Track monthly billing cycles per user for Cursor-style billing
-- Part of: Cursor-Style Billing System Implementation
-- 
-- Safety: Fully idempotent - safe to run multiple times
-- ==========================================================

-- Create billing_periods table
CREATE TABLE IF NOT EXISTS billing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'core', 'studio')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one billing period per user per start date
  UNIQUE (user_id, period_start)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_periods_user_id ON billing_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_periods_period_start ON billing_periods(period_start);
CREATE INDEX IF NOT EXISTS idx_billing_periods_user_period ON billing_periods(user_id, period_start);

-- Add column comments
COMMENT ON TABLE billing_periods IS 'Monthly billing cycles per user for Cursor-style billing system';
COMMENT ON COLUMN billing_periods.period_start IS 'Start of billing period (first day of month, UTC)';
COMMENT ON COLUMN billing_periods.period_end IS 'End of billing period (first day of next month, UTC)';
COMMENT ON COLUMN billing_periods.tier IS 'User subscription tier at period start (free, core, studio)';

-- Enable RLS
ALTER TABLE billing_periods ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own billing periods
CREATE POLICY "Users can view their own billing periods"
  ON billing_periods
  FOR SELECT
  USING (auth.uid() = user_id);

-- ✅ Migration complete - billing_periods table ready for Cursor-style billing

