-- Add engagement features to profiles and ritual_logs tables
-- For phases 1-3 of ritual improvements

-- 1. Add new columns to profiles table for engagement features
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_ritual_id uuid REFERENCES rituals(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS favorite_ritual_ids jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS streak_freeze_used_at timestamptz,
ADD COLUMN IF NOT EXISTS badges jsonb DEFAULT '{}'::jsonb;

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_last_ritual_id ON profiles(last_ritual_id);
CREATE INDEX IF NOT EXISTS idx_profiles_favorite_rituals ON profiles USING GIN(favorite_ritual_ids);
CREATE INDEX IF NOT EXISTS idx_profiles_badges ON profiles USING GIN(badges);

-- 3. Comments for documentation
COMMENT ON COLUMN profiles.last_ritual_id IS 'Last completed ritual ID for quick start feature';
COMMENT ON COLUMN profiles.favorite_ritual_ids IS 'Array of favorited ritual IDs';
COMMENT ON COLUMN profiles.streak_freeze_used_at IS 'Timestamp when streak freeze was last used (Core/Studio only)';
COMMENT ON COLUMN profiles.badges IS 'JSON object containing earned badges with timestamps';

-- 4. Add pattern tracking columns to ritual_logs
ALTER TABLE public.ritual_logs
ADD COLUMN IF NOT EXISTS hour_of_day int GENERATED ALWAYS AS (EXTRACT(hour FROM completed_at)::int) STORED,
ADD COLUMN IF NOT EXISTS day_of_week int GENERATED ALWAYS AS (EXTRACT(dow FROM completed_at)::int) STORED;

-- 5. Create indexes for pattern detection
CREATE INDEX IF NOT EXISTS idx_ritual_logs_hour ON ritual_logs(hour_of_day);
CREATE INDEX IF NOT EXISTS idx_ritual_logs_dow ON ritual_logs(day_of_week);
CREATE INDEX IF NOT EXISTS idx_ritual_logs_user_completed ON ritual_logs(user_id, completed_at DESC);

-- 6. Create function to check and award badges
CREATE OR REPLACE FUNCTION check_and_award_badges(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_badges jsonb;
  v_total_completions int;
  v_streak_data record;
  v_morning_rituals int;
BEGIN
  -- Get current badges
  SELECT COALESCE(badges, '{}'::jsonb) INTO v_badges
  FROM profiles WHERE id = p_user_id;

  -- Total completions badge
  SELECT COUNT(*) INTO v_total_completions
  FROM ritual_logs WHERE user_id = p_user_id;
  
  IF v_total_completions >= 10 AND NOT v_badges ? '10_rituals' THEN
    v_badges = v_badges || jsonb_build_object('10_rituals', jsonb_build_object(
      'earned_at', now(),
      'name', '10 Rituals Completed',
      'icon', 'award'
    ));
  END IF;
  
  IF v_total_completions >= 50 AND NOT v_badges ? '50_rituals' THEN
    v_badges = v_badges || jsonb_build_object('50_rituals', jsonb_build_object(
      'earned_at', now(),
      'name', '50 Rituals Completed',
      'icon', 'star'
    ));
  END IF;

  -- Morning person badge (5+ rituals before 9am)
  SELECT COUNT(*) INTO v_morning_rituals
  FROM ritual_logs 
  WHERE user_id = p_user_id 
  AND hour_of_day < 9;
  
  IF v_morning_rituals >= 5 AND NOT v_badges ? 'morning_person' THEN
    v_badges = v_badges || jsonb_build_object('morning_person', jsonb_build_object(
      'earned_at', now(),
      'name', 'Morning Person',
      'icon', 'sunrise'
    ));
  END IF;

  -- Update badges
  UPDATE profiles SET badges = v_badges WHERE id = p_user_id;
  
  RETURN v_badges;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger to check badges after ritual completion
CREATE OR REPLACE FUNCTION trigger_check_badges()
RETURNS TRIGGER AS $$
BEGIN
  -- Check badges in background (non-blocking)
  PERFORM check_and_award_badges(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_badges_on_ritual_complete ON ritual_logs;
CREATE TRIGGER check_badges_on_ritual_complete
  AFTER INSERT ON ritual_logs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_badges();

-- 8. Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_and_award_badges TO authenticated;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Ritual engagement features added successfully!';
  RAISE NOTICE '📊 New features: Quick start, favorites, streak freeze, badges, pattern tracking';
END $$;
