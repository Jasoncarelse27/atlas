-- Initialize budget_tracking rows for today (all tiers)
-- This ensures budget tracking works even if no messages have been sent today

INSERT INTO budget_tracking (date, tier, total_spend, request_count)
SELECT 
  CURRENT_DATE,
  tier,
  0,
  0
FROM (VALUES ('free'), ('core'), ('studio')) AS t(tier)
ON CONFLICT (date, tier) DO NOTHING;

-- Verify rows created
SELECT date, tier, total_spend, request_count 
FROM budget_tracking 
WHERE date = CURRENT_DATE
ORDER BY tier;

