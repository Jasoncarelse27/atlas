-- Add explicit columns to usage_logs table for better performance and consistency
-- Following Atlas best practices: explicit columns like daily_usage, model_usage_logs, budget_tracking

-- Drop existing constraint if it exists (to allow NULL values)
ALTER TABLE usage_logs DROP CONSTRAINT IF EXISTS usage_logs_tier_check;

-- Add columns if they don't exist
ALTER TABLE usage_logs
  ADD COLUMN IF NOT EXISTS tier TEXT,
  ADD COLUMN IF NOT EXISTS feature TEXT,
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add constraint that allows NULL values
ALTER TABLE usage_logs
  ADD CONSTRAINT usage_logs_tier_check CHECK (tier IS NULL OR tier IN ('free', 'core', 'studio'));

-- Create indexes for performance (critical for profitability queries)
CREATE INDEX IF NOT EXISTS idx_usage_logs_tier ON usage_logs(tier);
CREATE INDEX IF NOT EXISTS idx_usage_logs_feature ON usage_logs(feature);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_tier_created_at ON usage_logs(tier, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_tier ON usage_logs(user_id, tier) WHERE user_id IS NOT NULL;

-- Backfill existing data: Extract tier from metadata/data if available
-- ✅ FIXED: Validate tier values to prevent constraint violations (only accept 'free', 'core', 'studio')
UPDATE usage_logs
SET 
  tier = CASE 
    WHEN metadata->>'tier' IN ('free', 'core', 'studio') THEN metadata->>'tier'
    WHEN data->>'tier' IN ('free', 'core', 'studio') THEN data->>'tier'
    ELSE NULL
  END,
  feature = COALESCE(
    NULLIF(metadata->>'feature', ''),
    NULLIF(data->>'feature', ''),
    NULL
  ),
  tokens_used = COALESCE(
    (metadata->>'tokens_used')::INTEGER,
    (data->>'tokens_used')::INTEGER,
    0
  ),
  estimated_cost = COALESCE(
    (metadata->>'estimated_cost')::NUMERIC,
    (data->>'estimated_cost')::NUMERIC,
    0
  ),
  created_at = COALESCE(created_at, timestamp, NOW())
WHERE tier IS NULL OR feature IS NULL;

-- Add comment
COMMENT ON COLUMN usage_logs.tier IS 'User subscription tier at time of event (free, core, studio)';
COMMENT ON COLUMN usage_logs.feature IS 'Feature being used (chat, image, voice_call, etc.)';
COMMENT ON COLUMN usage_logs.tokens_used IS 'Total tokens consumed (input + output)';
COMMENT ON COLUMN usage_logs.estimated_cost IS 'Estimated API cost in USD';
COMMENT ON COLUMN usage_logs.metadata IS 'Additional event metadata (JSONB for flexibility)';


