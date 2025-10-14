-- Intelligent metering for Studio tier cost tracking
CREATE TABLE IF NOT EXISTS intelligent_metering (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
  stt_minutes NUMERIC DEFAULT 0,
  tts_characters NUMERIC DEFAULT 0,
  voice_calls_count INTEGER DEFAULT 0,
  estimated_cost NUMERIC(10,4) DEFAULT 0,
  anomaly_detected BOOLEAN DEFAULT false,
  anomaly_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_metering_user_month ON intelligent_metering(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_metering_anomaly ON intelligent_metering(anomaly_detected) WHERE anomaly_detected = true;

-- RLS policies
ALTER TABLE intelligent_metering ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own metering"
  ON intelligent_metering FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to detect anomalies
CREATE OR REPLACE FUNCTION detect_usage_anomaly(
  p_user_id UUID,
  p_estimated_cost NUMERIC
)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_is_anomaly BOOLEAN := false;
BEGIN
  -- Anomaly if daily cost exceeds $5
  IF p_estimated_cost > 5 THEN
    v_is_anomaly := true;
  END IF;
  
  -- Anomaly if 3x above average Studio user
  -- (Can add more sophisticated checks here)
  
  RETURN v_is_anomaly;
END;
$$;

 