-- =======================================================
-- Atlas Intelligent Tier Gate System - Production Schema
-- Safe, idempotent setup for Supabase
-- =======================================================

-- 1. Tier Budgets Table
CREATE TABLE IF NOT EXISTS tier_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL UNIQUE,
  daily_limit INTEGER NOT NULL,
  budget_ceiling NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tier Usage Table
CREATE TABLE IF NOT EXISTS tier_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  cost_accumulated NUMERIC DEFAULT 0,
  last_reset TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, tier)
);

-- 3. Function: Reset Daily Usage
CREATE OR REPLACE FUNCTION reset_daily_usage()
RETURNS void AS $$
BEGIN
  UPDATE tier_usage
  SET message_count = 0,
      cost_accumulated = 0,
      last_reset = now();
END;
$$ LANGUAGE plpgsql;

-- 4. Function: Increment Usage
CREATE OR REPLACE FUNCTION increment_usage(p_user_id UUID, p_tier TEXT, p_cost NUMERIC)
RETURNS void AS $$
BEGIN
  INSERT INTO tier_usage (user_id, tier, message_count, cost_accumulated)
  VALUES (p_user_id, p_tier, 1, p_cost)
  ON CONFLICT (user_id, tier) DO UPDATE
    SET message_count = tier_usage.message_count + 1,
        cost_accumulated = tier_usage.cost_accumulated + p_cost,
        last_reset = now();
END;
$$ LANGUAGE plpgsql;

-- 5. Function: Enforce Tier Budget
CREATE OR REPLACE FUNCTION enforce_tier_budget(p_user_id UUID, p_tier TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  usage_rec RECORD;
  budget_rec RECORD;
BEGIN
  SELECT * INTO usage_rec FROM tier_usage WHERE user_id = p_user_id AND tier = p_tier;
  SELECT * INTO budget_rec FROM tier_budgets WHERE tier = p_tier;

  IF usage_rec.message_count >= budget_rec.daily_limit THEN
    RAISE EXCEPTION 'Daily message limit reached for tier %', p_tier;
  END IF;

  IF usage_rec.cost_accumulated >= budget_rec.budget_ceiling THEN
    RAISE EXCEPTION 'Budget ceiling reached for tier %', p_tier;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 6. Metrics View
CREATE OR REPLACE VIEW tier_metrics AS
SELECT
  u.id AS user_id,
  u.email,
  tu.tier,
  tu.message_count,
  tu.cost_accumulated,
  tb.daily_limit,
  tb.budget_ceiling,
  tu.last_reset
FROM tier_usage tu
JOIN auth.users u ON u.id = tu.user_id
JOIN tier_budgets tb ON tb.tier = tu.tier;

-- =======================================================
-- Seed Default Budgets (safe upserts)
-- =======================================================
INSERT INTO tier_budgets (tier, daily_limit, budget_ceiling)
VALUES 
  ('free', 15, 20.00),
  ('core', 999999, 100.00),
  ('studio', 999999, 80.00)
ON CONFLICT (tier) DO UPDATE
  SET daily_limit = EXCLUDED.daily_limit,
      budget_ceiling = EXCLUDED.budget_ceiling;

-- =======================================================
-- ✅ Done: Schema enables /admin/metrics + tier enforcement
-- =======================================================