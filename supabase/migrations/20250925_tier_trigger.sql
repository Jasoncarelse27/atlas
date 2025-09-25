CREATE OR REPLACE FUNCTION update_profile_tier()
RETURNS TRIGGER AS $$
DECLARE
  new_tier TEXT;
BEGIN
  -- Determine tier from subscription table
  IF NEW.status = 'active' AND NEW.plan = 'studio' THEN
    new_tier := 'studio';
  ELSIF NEW.status = 'active' AND NEW.plan = 'core' THEN
    new_tier := 'core';
  ELSE
    new_tier := 'free';
  END IF;

  -- Update profile record
  UPDATE profiles
  SET subscription_tier = new_tier
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_update_tier ON subscriptions;

CREATE TRIGGER subscriptions_update_tier
AFTER INSERT OR UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_profile_tier();
