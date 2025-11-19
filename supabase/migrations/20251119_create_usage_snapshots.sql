-- ==========================================================
-- Atlas Usage Snapshots Table Migration
-- ==========================================================
-- Purpose: Aggregated usage per billing period per model for fast UI queries
-- Part of: Cursor-Style Billing System Implementation
-- 
-- Safety: Fully idempotent - safe to run multiple times
-- ==========================================================

-- Create usage_snapshots table
CREATE TABLE IF NOT EXISTS usage_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  billing_period_id UUID NOT NULL REFERENCES billing_periods(id) ON DELETE CASCADE,
  model TEXT NOT NULL, -- e.g. 'claude-3-opus', 'claude-sonnet-4-5-20250929', 'claude-3-haiku-20240307'
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one snapshot per billing period per model
  UNIQUE (billing_period_id, model)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_billing_period_id ON usage_snapshots(billing_period_id);
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_user_id ON usage_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_model ON usage_snapshots(model);
CREATE INDEX IF NOT EXISTS idx_usage_snapshots_user_period ON usage_snapshots(user_id, billing_period_id);

-- Add column comments
COMMENT ON TABLE usage_snapshots IS 'Aggregated token usage per billing period per model for Cursor-style billing';
COMMENT ON COLUMN usage_snapshots.model IS 'AI model name (e.g. claude-sonnet-4-5-20250929)';
COMMENT ON COLUMN usage_snapshots.input_tokens IS 'Total input tokens consumed in this period for this model';
COMMENT ON COLUMN usage_snapshots.output_tokens IS 'Total output tokens consumed in this period for this model';
COMMENT ON COLUMN usage_snapshots.total_cost_usd IS 'Total cost in USD for this model in this period';

-- Enable RLS
ALTER TABLE usage_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own usage snapshots
CREATE POLICY "Users can view their own usage snapshots"
  ON usage_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

-- ✅ Migration complete - usage_snapshots table ready for aggregated usage tracking

