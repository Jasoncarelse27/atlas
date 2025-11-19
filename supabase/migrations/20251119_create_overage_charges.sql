-- ==========================================================
-- Atlas Overage Charges Table Migration
-- ==========================================================
-- Purpose: Track overage invoices (mid-month + end-month) for Cursor-style billing
-- Part of: Cursor-Style Billing System Implementation
-- 
-- Safety: Fully idempotent - safe to run multiple times
-- ==========================================================

-- Create overage_charges table
CREATE TABLE IF NOT EXISTS overage_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  billing_period_id UUID NOT NULL REFERENCES billing_periods(id) ON DELETE CASCADE,
  fastspring_order_id TEXT, -- NULL until FastSpring invoice is created
  description TEXT NOT NULL, -- e.g. "Atlas Usage for November 2025 (Mid-Month Invoice)"
  tokens BIGINT NOT NULL DEFAULT 0, -- Total tokens that caused this overage
  cost_usd NUMERIC(12,4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'charged', 'failed', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  charged_at TIMESTAMPTZ -- Set when status changes to 'charged'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_overage_charges_user_id ON overage_charges(user_id);
CREATE INDEX IF NOT EXISTS idx_overage_charges_billing_period_id ON overage_charges(billing_period_id);
CREATE INDEX IF NOT EXISTS idx_overage_charges_status ON overage_charges(status);
CREATE INDEX IF NOT EXISTS idx_overage_charges_fastspring_order_id ON overage_charges(fastspring_order_id) WHERE fastspring_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_overage_charges_created_at ON overage_charges(created_at DESC);

-- Add column comments
COMMENT ON TABLE overage_charges IS 'Overage invoices (mid-month + end-month) for Cursor-style billing';
COMMENT ON COLUMN overage_charges.fastspring_order_id IS 'FastSpring order ID after invoice is created (NULL until charged)';
COMMENT ON COLUMN overage_charges.description IS 'Human-readable invoice description';
COMMENT ON COLUMN overage_charges.status IS 'Invoice status: pending (created but not charged), charged (paid), failed (payment failed), refunded (refunded)';
COMMENT ON COLUMN overage_charges.charged_at IS 'Timestamp when invoice was successfully charged via FastSpring';

-- Enable RLS
ALTER TABLE overage_charges ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own overage charges
CREATE POLICY "Users can view their own overage charges"
  ON overage_charges
  FOR SELECT
  USING (auth.uid() = user_id);

-- ✅ Migration complete - overage_charges table ready for Cursor-style overage billing

