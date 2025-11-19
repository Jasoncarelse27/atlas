-- ==========================================================
-- Atlas Usage Snapshot Upsert Function Migration
-- ==========================================================
-- Purpose: Postgres function to upsert usage snapshots atomically
-- Part of: Cursor-Style Billing System Implementation
-- 
-- Safety: Fully idempotent - safe to run multiple times
-- ==========================================================

-- Create or replace function to upsert usage snapshot
CREATE OR REPLACE FUNCTION upsert_usage_snapshot(
  p_user_id UUID,
  p_model TEXT,
  p_input_tokens BIGINT,
  p_output_tokens BIGINT,
  p_cost_usd NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_billing_period_id UUID;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_tier TEXT;
BEGIN
  -- Calculate current billing period boundaries (first day of current month to first day of next month)
  v_period_start := date_trunc('month', NOW())::TIMESTAMPTZ;
  v_period_end := (date_trunc('month', NOW()) + INTERVAL '1 month')::TIMESTAMPTZ;
  
  -- Get user's current tier from profiles
  SELECT subscription_tier INTO v_tier
  FROM profiles
  WHERE id = p_user_id;
  
  -- Default to 'free' if tier not found
  IF v_tier IS NULL THEN
    v_tier := 'free';
  END IF;
  
  -- Find or create billing period for this user and period
  INSERT INTO billing_periods (user_id, period_start, period_end, tier)
  VALUES (p_user_id, v_period_start, v_period_end, v_tier)
  ON CONFLICT (user_id, period_start) DO UPDATE
    SET updated_at = NOW()
  RETURNING id INTO v_billing_period_id;
  
  -- If insert didn't return ID, fetch it
  IF v_billing_period_id IS NULL THEN
    SELECT id INTO v_billing_period_id
    FROM billing_periods
    WHERE user_id = p_user_id
      AND period_start = v_period_start;
  END IF;
  
  -- Upsert usage snapshot for this billing period and model
  INSERT INTO usage_snapshots (
    user_id,
    billing_period_id,
    model,
    input_tokens,
    output_tokens,
    total_cost_usd
  )
  VALUES (
    p_user_id,
    v_billing_period_id,
    p_model,
    p_input_tokens,
    p_output_tokens,
    p_cost_usd
  )
  ON CONFLICT (billing_period_id, model) DO UPDATE
  SET
    input_tokens = usage_snapshots.input_tokens + EXCLUDED.input_tokens,
    output_tokens = usage_snapshots.output_tokens + EXCLUDED.output_tokens,
    total_cost_usd = usage_snapshots.total_cost_usd + EXCLUDED.total_cost_usd,
    updated_at = NOW();
  
  RETURN v_billing_period_id;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION upsert_usage_snapshot IS 'Atomically upserts usage snapshot for a billing period and model. Creates billing period if needed. Returns billing_period_id.';

-- Grant execute permission to authenticated users (via service role in backend)
-- Note: Function uses SECURITY DEFINER, so it runs with creator's privileges

-- ✅ Migration complete - upsert_usage_snapshot function ready for usage aggregation

