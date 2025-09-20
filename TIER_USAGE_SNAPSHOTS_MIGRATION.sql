-- =======================================================
-- Atlas Tier Usage Snapshots System - Database Migration
-- Adds daily snapshots, trends, and admin monitoring
-- =======================================================

-- 1. 📂 Database: tier_usage_snapshots table
CREATE TABLE IF NOT EXISTS tier_usage_snapshots (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'core', 'studio')),
  message_count INTEGER DEFAULT 0,
  cost_accumulated NUMERIC(10,2) DEFAULT 0,
  daily_limit INTEGER NOT NULL,
  budget_ceiling NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BLOCKED - Daily Limit', 'BLOCKED - Budget Ceiling')),
  snapshot_date DATE DEFAULT current_date,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add unique index for fast lookups and prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_tier_snapshots_user_date 
ON tier_usage_snapshots(user_id, snapshot_date);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tier_snapshots_date ON tier_usage_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_tier_snapshots_tier ON tier_usage_snapshots(tier);
CREATE INDEX IF NOT EXISTS idx_tier_snapshots_status ON tier_usage_snapshots(status);
CREATE INDEX IF NOT EXISTS idx_tier_snapshots_email ON tier_usage_snapshots(email);

-- 2. ⚡ Function: take_tier_usage_snapshot()
CREATE OR REPLACE FUNCTION take_tier_usage_snapshot()
RETURNS INTEGER AS $$
DECLARE
  snapshot_count INTEGER := 0;
BEGIN
  -- Insert snapshots for all users with tier usage
  INSERT INTO tier_usage_snapshots (
    user_id,
    email,
    tier,
    message_count,
    cost_accumulated,
    daily_limit,
    budget_ceiling,
    status,
    snapshot_date
  )
  SELECT 
    u.id as user_id,
    u.email,
    tu.tier,
    COALESCE(tu.message_count, 0) as message_count,
    COALESCE(tu.cost_accumulated, 0) as cost_accumulated,
    tb.daily_limit,
    tb.budget_ceiling,
    CASE 
      WHEN tu.message_count >= tb.daily_limit AND tb.daily_limit > 0 THEN 'BLOCKED - Daily Limit'
      WHEN tu.cost_accumulated >= tb.budget_ceiling THEN 'BLOCKED - Budget Ceiling'
      ELSE 'ACTIVE'
    END as status,
    current_date as snapshot_date
  FROM auth.users u
  LEFT JOIN tier_usage tu ON u.id = tu.user_id
  LEFT JOIN tier_budgets tb ON tu.tier = tb.tier
  WHERE tu.tier IS NOT NULL -- Only users with tier usage
  ON CONFLICT (user_id, snapshot_date) DO NOTHING;
  
  GET DIAGNOSTICS snapshot_count = ROW_COUNT;
  
  RAISE NOTICE 'Created % tier usage snapshots for %', snapshot_count, current_date;
  RETURN snapshot_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ⏰ Schedule with pg_cron (if available)
-- Note: pg_cron extension needs to be enabled in Supabase
-- This will run at midnight UTC daily
SELECT cron.schedule(
  'daily-tier-usage-snapshot',
  '0 0 * * *',
  'SELECT take_tier_usage_snapshot();'
);

-- 4. 📊 Admin View: daily_usage_trends
CREATE OR REPLACE VIEW daily_usage_trends AS
SELECT 
  email,
  tier,
  snapshot_date,
  message_count,
  cost_accumulated,
  daily_limit,
  budget_ceiling,
  status,
  ROUND((message_count::NUMERIC / NULLIF(daily_limit, 0)) * 100, 2) as limit_utilization_pct,
  ROUND((cost_accumulated / budget_ceiling) * 100, 2) as budget_utilization_pct,
  created_at
FROM tier_usage_snapshots
ORDER BY snapshot_date DESC, email;

-- 5. 🔍 Helper Functions for Admin Queries
CREATE OR REPLACE FUNCTION get_user_usage_trend(p_email TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(
  snapshot_date DATE,
  tier TEXT,
  message_count INTEGER,
  cost_accumulated NUMERIC,
  status TEXT,
  limit_utilization_pct NUMERIC,
  budget_utilization_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.snapshot_date,
    s.tier,
    s.message_count,
    s.cost_accumulated,
    s.status,
    ROUND((s.message_count::NUMERIC / NULLIF(s.daily_limit, 0)) * 100, 2) as limit_utilization_pct,
    ROUND((s.cost_accumulated / s.budget_ceiling) * 100, 2) as budget_utilization_pct
  FROM tier_usage_snapshots s
  WHERE s.email = p_email
    AND s.snapshot_date >= current_date - p_days
  ORDER BY s.snapshot_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_tier_summary(p_date DATE DEFAULT current_date)
RETURNS TABLE(
  tier TEXT,
  total_users BIGINT,
  active_users BIGINT,
  blocked_users BIGINT,
  avg_messages NUMERIC,
  avg_cost NUMERIC,
  total_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.tier,
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE s.status = 'ACTIVE') as active_users,
    COUNT(*) FILTER (WHERE s.status LIKE 'BLOCKED%') as blocked_users,
    ROUND(AVG(s.message_count), 2) as avg_messages,
    ROUND(AVG(s.cost_accumulated), 4) as avg_cost,
    ROUND(SUM(s.cost_accumulated), 2) as total_cost
  FROM tier_usage_snapshots s
  WHERE s.snapshot_date = p_date
  GROUP BY s.tier
  ORDER BY s.tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on snapshots table
ALTER TABLE tier_usage_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy for service role access
CREATE POLICY "srv_role_manage_snapshots" ON tier_usage_snapshots 
FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON daily_usage_trends TO authenticated;
GRANT EXECUTE ON FUNCTION take_tier_usage_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_usage_trend(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tier_summary(DATE) TO authenticated;

-- =======================================================
-- ✅ Validation Queries - Run these after migration
-- =======================================================

-- Take a manual snapshot for testing
SELECT take_tier_usage_snapshot();

-- Check yesterday's snapshot
SELECT * FROM tier_usage_snapshots WHERE snapshot_date = current_date ORDER BY email;

-- View trends for Jason's test account
SELECT * FROM get_user_usage_trend('jasonc.jpg@gmail.com', 7);

-- Get today's tier summary
SELECT * FROM get_tier_summary(current_date);

-- Check daily usage trends view
SELECT * FROM daily_usage_trends LIMIT 10;

-- =======================================================
-- Atlas Tier Usage Snapshots System Ready! 📊
-- =======================================================
