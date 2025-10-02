-- Create image_analyses table for storing image analysis results
CREATE TABLE IF NOT EXISTS image_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  analysis TEXT NOT NULL,
  prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create image_events table for tracking image upload/scan events
CREATE TABLE IF NOT EXISTS image_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  file_path TEXT,
  file_size INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_image_analyses_user_id ON image_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_image_analyses_created_at ON image_analyses(created_at);
CREATE INDEX IF NOT EXISTS idx_image_events_user_id ON image_events(user_id);
CREATE INDEX IF NOT EXISTS idx_image_events_event_name ON image_events(event_name);

-- Enable RLS (Row Level Security)
ALTER TABLE image_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own image analyses" ON image_analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own image analyses" ON image_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own image events" ON image_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own image events" ON image_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
