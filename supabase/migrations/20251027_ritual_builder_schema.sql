-- =====================================================
-- Atlas Ritual Builder - Database Schema
-- Created: October 27, 2025
-- =====================================================

-- Table: rituals
-- Stores both preset rituals (system-defined) and user-created custom rituals
CREATE TABLE IF NOT EXISTS rituals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  goal TEXT NOT NULL CHECK (goal IN ('energy', 'calm', 'focus', 'creativity')),
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_preset BOOLEAN NOT NULL DEFAULT false,
  tier_required TEXT NOT NULL CHECK (tier_required IN ('free', 'core', 'studio')) DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: ritual_logs
-- Tracks ritual completions with mood tracking
CREATE TABLE IF NOT EXISTS ritual_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER NOT NULL,
  mood_before TEXT NOT NULL,
  mood_after TEXT NOT NULL,
  notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rituals_user_id ON rituals(user_id);
CREATE INDEX IF NOT EXISTS idx_rituals_is_preset ON rituals(is_preset);
CREATE INDEX IF NOT EXISTS idx_rituals_tier_required ON rituals(tier_required);
CREATE INDEX IF NOT EXISTS idx_ritual_logs_user_id ON ritual_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ritual_logs_ritual_id ON ritual_logs(ritual_id);
CREATE INDEX IF NOT EXISTS idx_ritual_logs_completed_at ON ritual_logs(completed_at);

-- RLS Policies for rituals table
ALTER TABLE rituals ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read preset rituals
CREATE POLICY "Anyone can read preset rituals"
  ON rituals FOR SELECT
  USING (is_preset = true);

-- Policy: Users can read their own custom rituals
CREATE POLICY "Users can read own custom rituals"
  ON rituals FOR SELECT
  USING (auth.uid() = user_id AND is_preset = false);

-- Policy: Users can create custom rituals
CREATE POLICY "Users can create custom rituals"
  ON rituals FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND is_preset = false
  );

-- Policy: Users can update their own custom rituals
CREATE POLICY "Users can update own custom rituals"
  ON rituals FOR UPDATE
  USING (auth.uid() = user_id AND is_preset = false)
  WITH CHECK (auth.uid() = user_id AND is_preset = false);

-- Policy: Users can delete their own custom rituals
CREATE POLICY "Users can delete own custom rituals"
  ON rituals FOR DELETE
  USING (auth.uid() = user_id AND is_preset = false);

-- RLS Policies for ritual_logs table
ALTER TABLE ritual_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own ritual logs
CREATE POLICY "Users can read own ritual logs"
  ON ritual_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create ritual logs
CREATE POLICY "Users can create ritual logs"
  ON ritual_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own ritual logs
CREATE POLICY "Users can update own ritual logs"
  ON ritual_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own ritual logs
CREATE POLICY "Users can delete own ritual logs"
  ON ritual_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rituals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update updated_at on ritual changes
CREATE TRIGGER rituals_updated_at_trigger
  BEFORE UPDATE ON rituals
  FOR EACH ROW
  EXECUTE FUNCTION update_rituals_updated_at();

-- =====================================================
-- Preset Ritual Templates (System Data)
-- =====================================================

-- Insert preset rituals (available to all users)
INSERT INTO rituals (id, title, goal, steps, is_preset, tier_required, user_id) VALUES

-- Free Tier Presets (2 rituals)
(
  '00000000-0000-0000-0000-000000000001',
  'Morning Boost',
  'energy',
  '[
    {"type": "breathing", "duration": 120, "order": 1, "config": {"title": "Breathing Exercise", "instructions": "Box breathing: Inhale for 4 counts, hold for 4, exhale for 4, hold for 4. Repeat."}},
    {"type": "affirmation", "duration": 60, "order": 2, "config": {"title": "Affirmations", "instructions": "Repeat: ''I am energized and ready for today. I handle challenges with calm confidence.''"}},
    {"type": "focus", "duration": 180, "order": 3, "config": {"title": "Focus Exercise", "instructions": "Set your top 3 intentions for the day. Write them down or say them aloud."}}
  ]'::jsonb,
  true,
  'free',
  NULL
),

(
  '00000000-0000-0000-0000-000000000002',
  'Evening Wind Down',
  'calm',
  '[
    {"type": "breathing", "duration": 180, "order": 1, "config": {"title": "Breathing Exercise", "instructions": "4-7-8 breathing: Inhale for 4, hold for 7, exhale for 8. Repeat 4 times."}},
    {"type": "reflection", "duration": 120, "order": 2, "config": {"title": "Reflection", "instructions": "Think about 3 things that went well today. What did you learn?"}},
    {"type": "gratitude", "duration": 120, "order": 3, "config": {"title": "Gratitude Practice", "instructions": "Name 3 things you''re grateful for today. Feel the appreciation."}}
  ]'::jsonb,
  true,
  'free',
  NULL
),

-- Core/Studio Tier Presets (6 rituals)
(
  '00000000-0000-0000-0000-000000000003',
  'Stress Reset',
  'calm',
  '[
    {"type": "breathing", "duration": 180, "order": 1, "config": {"title": "Deep Breathing", "instructions": "Focus on your breath. Inhale calm, exhale tension. Let your shoulders drop."}},
    {"type": "affirmation", "duration": 120, "order": 2, "config": {"title": "Calming Affirmations", "instructions": "Repeat: ''I am safe. I am capable. I release what I cannot control.''"}},
    {"type": "stretch", "duration": 120, "order": 3, "config": {"title": "Gentle Stretch", "instructions": "Roll your shoulders back. Stretch your neck gently side to side. Release tension."}}
  ]'::jsonb,
  true,
  'core',
  NULL
),

(
  '00000000-0000-0000-0000-000000000004',
  'Creative Flow',
  'creativity',
  '[
    {"type": "breathing", "duration": 120, "order": 1, "config": {"title": "Energizing Breath", "instructions": "Take 3 deep breaths. Imagine breathing in creative energy and possibility."}},
    {"type": "visualization", "duration": 180, "order": 2, "config": {"title": "Creative Visualization", "instructions": "Visualize yourself creating effortlessly. See ideas flowing freely."}},
    {"type": "affirmation", "duration": 120, "order": 3, "config": {"title": "Creative Affirmations", "instructions": "Repeat: ''Ideas flow through me easily. I trust my creative instincts.''"}},
    {"type": "focus", "duration": 180, "order": 4, "config": {"title": "Set Creative Intention", "instructions": "What do you want to create today? Set a clear, exciting intention."}}
  ]'::jsonb,
  true,
  'core',
  NULL
),

(
  '00000000-0000-0000-0000-000000000005',
  'Productivity Sprint',
  'focus',
  '[
    {"type": "breathing", "duration": 120, "order": 1, "config": {"title": "Clearing Breath", "instructions": "3 deep breaths. Clear your mind of distractions."}},
    {"type": "focus", "duration": 300, "order": 2, "config": {"title": "Priority Setting", "instructions": "What ONE thing matters most right now? Write it down."}},
    {"type": "affirmation", "duration": 60, "order": 3, "config": {"title": "Focus Affirmation", "instructions": "Repeat: ''I am focused. I complete what I start. Distractions fade away.''"}},
    {"type": "visualization", "duration": 120, "order": 4, "config": {"title": "Success Visualization", "instructions": "See yourself completing your priority task. Feel the satisfaction."}}
  ]'::jsonb,
  true,
  'core',
  NULL
),

(
  '00000000-0000-0000-0000-000000000006',
  'Confidence Builder',
  'energy',
  '[
    {"type": "breathing", "duration": 120, "order": 1, "config": {"title": "Power Breathing", "instructions": "Stand tall. Take 3 deep, powerful breaths. Fill your chest."}},
    {"type": "affirmation", "duration": 180, "order": 2, "config": {"title": "Confidence Affirmations", "instructions": "Repeat: ''I am capable. I am prepared. I trust myself completely.''"}},
    {"type": "visualization", "duration": 120, "order": 3, "config": {"title": "Success Visualization", "instructions": "See yourself succeeding. Hear the positive feedback. Feel the confidence."}}
  ]'::jsonb,
  true,
  'core',
  NULL
),

(
  '00000000-0000-0000-0000-000000000007',
  'Deep Work Prep',
  'focus',
  '[
    {"type": "breathing", "duration": 180, "order": 1, "config": {"title": "Centering Breath", "instructions": "Box breathing for 3 minutes. Calm your nervous system."}},
    {"type": "focus", "duration": 240, "order": 2, "config": {"title": "Work Block Planning", "instructions": "What will you accomplish in the next 90 minutes? Be specific."}},
    {"type": "visualization", "duration": 180, "order": 3, "config": {"title": "Flow State Visualization", "instructions": "Imagine working with total focus. Time disappears. You''re in the zone."}},
    {"type": "affirmation", "duration": 60, "order": 4, "config": {"title": "Deep Work Affirmation", "instructions": "Repeat: ''I work with laser focus. Interruptions bounce off me. I am unstoppable.''"}}
  ]'::jsonb,
  true,
  'core',
  NULL
),

(
  '00000000-0000-0000-0000-000000000008',
  'Sleep Preparation',
  'calm',
  '[
    {"type": "breathing", "duration": 240, "order": 1, "config": {"title": "Sleep Breathing", "instructions": "4-7-8 breathing: Inhale 4, hold 7, exhale 8. Repeat until deeply relaxed."}},
    {"type": "reflection", "duration": 120, "order": 2, "config": {"title": "Day Reflection", "instructions": "Acknowledge today without judgment. Let go of what wasn''t perfect."}},
    {"type": "gratitude", "duration": 120, "order": 3, "config": {"title": "Gratitude", "instructions": "Name 3 things from today you''re grateful for. Feel the warmth."}},
    {"type": "visualization", "duration": 120, "order": 4, "config": {"title": "Peaceful Visualization", "instructions": "Imagine a peaceful place. Safe, calm, comfortable. You are at ease."}}
  ]'::jsonb,
  true,
  'core',
  NULL
);

-- =====================================================
-- NOTES FOR DEVELOPERS
-- =====================================================
-- 
-- Step Types Available:
-- - breathing: Breathing exercises (box breathing, 4-7-8, etc.)
-- - affirmation: Positive affirmations
-- - meditation: Guided meditation
-- - focus: Focus exercises (planning, prioritizing)
-- - stretch: Physical stretching
-- - journaling: Written reflection
-- - gratitude: Gratitude practice
-- - visualization: Mental visualization
-- - reflection: Day/situation reflection
--
-- To add new preset rituals:
-- 1. Generate a new UUID
-- 2. Set is_preset = true
-- 3. Set tier_required appropriately
-- 4. Set user_id = NULL (system ritual)
-- 5. Define steps as JSONB array
--
-- To query rituals for a user:
-- - Free tier: SELECT * FROM rituals WHERE is_preset = true AND tier_required = 'free'
-- - Core tier: SELECT * FROM rituals WHERE is_preset = true AND tier_required IN ('free', 'core')
-- - Studio tier: SELECT * FROM rituals WHERE is_preset = true (all presets)
-- - Custom: SELECT * FROM rituals WHERE user_id = [user_id] AND is_preset = false
--
-- =====================================================

