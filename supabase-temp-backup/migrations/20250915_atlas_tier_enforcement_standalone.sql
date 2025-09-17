-- ===============================
-- Atlas V1 Golden Standard Tier Enforcement Schema (Standalone)
-- ===============================
-- Date: 2025-09-15
-- Purpose: Feature flags and telemetry for tier-based access control
-- This is a standalone migration that doesn't depend on existing tables

-- ===============================
-- 1. Feature Flags (Config-Driven Gating)
-- ===============================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,                       -- e.g., 'audio', 'image', 'text'
  enabled BOOLEAN NOT NULL DEFAULT true,       -- master on/off
  tier_override TEXT CHECK (tier_override IN ('free', 'core', 'studio')), -- optional
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feature_flags_feature_idx ON feature_flags(feature);
CREATE INDEX IF NOT EXISTS feature_flags_tier_idx ON feature_flags(tier_override);

-- ===============================
-- 2. Feature Attempts (Telemetry / Conversion Funnel)
-- ===============================

CREATE TABLE IF NOT EXISTS feature_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,                       -- 'text', 'audio', 'image'
  tier TEXT NOT NULL CHECK (tier IN ('free', 'core', 'studio')),
  allowed BOOLEAN NOT NULL,                    -- true = feature worked, false = blocked
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feature_attempts_user_idx ON feature_attempts(user_id);
CREATE INDEX IF NOT EXISTS feature_attempts_feature_idx ON feature_attempts(feature);
CREATE INDEX IF NOT EXISTS feature_attempts_tier_idx ON feature_attempts(tier);
CREATE INDEX IF NOT EXISTS feature_attempts_timestamp_idx ON feature_attempts(timestamp);

-- ===============================
-- 3. Seed Default Feature Flags
-- ===============================

INSERT INTO feature_flags (feature, enabled, tier_override)
VALUES
  ('text', true, null),      -- Text chat enabled for all tiers
  ('audio', true, null),     -- Audio enabled for all tiers (tier logic in app)
  ('image', true, null)      -- Image enabled for all tiers (tier logic in app)
ON CONFLICT DO NOTHING;

-- ===============================
-- 4. RLS Policies
-- ===============================

-- Enable RLS on feature_attempts
ALTER TABLE feature_attempts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own feature attempts
CREATE POLICY "Users can view their own feature attempts" ON feature_attempts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own feature attempts
CREATE POLICY "Users can insert their own feature attempts" ON feature_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Feature flags are read-only for users (admin controlled)
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read feature flags
CREATE POLICY "Authenticated users can read feature flags" ON feature_flags
  FOR SELECT USING (auth.role() = 'authenticated');

-- ===============================
-- 5. Helper Functions
-- ===============================

-- Function to log feature attempt
CREATE OR REPLACE FUNCTION log_feature_attempt(
  p_user_id UUID,
  p_feature TEXT,
  p_tier TEXT,
  p_allowed BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_attempts (user_id, feature, tier, allowed)
  VALUES (p_user_id, p_feature, p_tier, p_allowed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================
-- 6. Analytics Views
-- ===============================

-- View for conversion funnel analysis
CREATE OR REPLACE VIEW feature_conversion_funnel AS
SELECT 
  feature,
  tier,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE allowed = true) as successful_attempts,
  COUNT(*) FILTER (WHERE allowed = false) as blocked_attempts,
  ROUND(
    (COUNT(*) FILTER (WHERE allowed = true)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as success_rate_percent
FROM feature_attempts
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY feature, tier
ORDER BY feature, tier;

-- View for daily feature usage
CREATE OR REPLACE VIEW daily_feature_usage AS
SELECT 
  DATE(timestamp) as date,
  feature,
  tier,
  COUNT(*) as attempts,
  COUNT(*) FILTER (WHERE allowed = true) as successful
FROM feature_attempts
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp), feature, tier
ORDER BY date DESC, feature, tier;

-- ===============================
-- Verification queries
-- ===============================

SELECT 'Feature flags created' as status, COUNT(*) as count FROM feature_flags;
SELECT 'Feature attempts table created' as status, COUNT(*) as count FROM feature_attempts;
SELECT 'RLS policies created' as status, COUNT(*) as count FROM pg_policies WHERE tablename IN ('feature_flags', 'feature_attempts');
