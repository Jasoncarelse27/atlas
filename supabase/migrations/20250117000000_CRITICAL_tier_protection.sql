-- 🔒 CRITICAL SECURITY MIGRATION: Tier Protection
-- This migration prevents users from updating their own subscription tier
-- and ensures only the service role (via webhooks) can modify subscription fields.
--
-- Security Impact: Prevents $189.99/user revenue loss from tier escalation attacks
-- Created: 2025-01-17

-- Step 1: Drop ALL existing insecure update policies on profiles table
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;

-- Step 2: Create field-restricted update policy for users
-- ✅ ALLOWS: Users to update their own metadata (email, preferences, avatar)
-- ❌ BLOCKS: Users from updating subscription_tier, subscription_status, subscription_id
CREATE POLICY "Users can update own metadata only" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Ensure user can only modify non-subscription fields
    -- Subscription fields MUST remain unchanged by user updates
    OLD.subscription_tier IS NOT DISTINCT FROM NEW.subscription_tier AND
    OLD.subscription_status IS NOT DISTINCT FROM NEW.subscription_status AND
    OLD.subscription_id IS NOT DISTINCT FROM NEW.subscription_id AND
    OLD.trial_ends_at IS NOT DISTINCT FROM NEW.trial_ends_at AND
    OLD.subscription_expires_at IS NOT DISTINCT FROM NEW.subscription_expires_at
  );

-- Step 3: Create service role policy for webhook updates
-- ✅ Only the service role (used by FastSpring webhooks) can update subscription fields
CREATE POLICY "Service role can update subscriptions" ON public.profiles
  FOR UPDATE
  USING (
    -- Check if the request is using service role key
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Step 4: Add audit trigger for subscription changes
-- This logs all tier changes for security monitoring
CREATE OR REPLACE FUNCTION audit_tier_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if tier actually changed
  IF OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier THEN
    INSERT INTO public.subscription_audit (
      profile_id,
      event_type,
      old_tier,
      new_tier,
      provider,
      metadata,
      created_at
    ) VALUES (
      NEW.id,
      'tier_change',
      OLD.subscription_tier,
      NEW.subscription_tier,
      'system',
      jsonb_build_object(
        'changed_by', current_user,
        'role', current_setting('request.jwt.claims', true)::json->>'role',
        'timestamp', NOW()
      ),
      NOW()
    );
    
    -- Log to console for monitoring
    RAISE NOTICE 'Tier changed for user %: % -> %', NEW.id, OLD.subscription_tier, NEW.subscription_tier;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS audit_tier_changes_trigger ON public.profiles;
CREATE TRIGGER audit_tier_changes_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_tier_changes();

-- Step 5: Create security monitoring view
CREATE OR REPLACE VIEW security_alerts AS
SELECT 
  p.id,
  p.email,
  p.subscription_tier,
  p.subscription_status,
  p.subscription_id,
  p.updated_at,
  CASE 
    -- Alert: Paid tier without subscription ID
    WHEN p.subscription_tier IN ('core', 'studio') AND p.subscription_id IS NULL 
      THEN 'CRITICAL: Paid tier without subscription_id'
    
    -- Alert: Active status on free tier (suspicious)
    WHEN p.subscription_status = 'active' AND p.subscription_tier = 'free'
      THEN 'WARNING: Active status on free tier'
    
    -- Alert: Expired subscription still active
    WHEN p.subscription_expires_at < NOW() AND p.subscription_status = 'active'
      THEN 'WARNING: Expired subscription still active'
    
    ELSE NULL
  END AS alert,
  
  -- Alert severity
  CASE 
    WHEN p.subscription_tier IN ('core', 'studio') AND p.subscription_id IS NULL 
      THEN 'CRITICAL'
    WHEN p.subscription_status = 'active' AND p.subscription_tier = 'free'
      THEN 'MEDIUM'
    WHEN p.subscription_expires_at < NOW() AND p.subscription_status = 'active'
      THEN 'HIGH'
    ELSE 'NONE'
  END AS severity
FROM profiles p
WHERE 
  -- Only show alerts
  (p.subscription_tier IN ('core', 'studio') AND p.subscription_id IS NULL) OR
  (p.subscription_status = 'active' AND p.subscription_tier = 'free') OR
  (p.subscription_expires_at < NOW() AND p.subscription_status = 'active');

-- Step 6: Grant permissions
GRANT SELECT ON security_alerts TO authenticated;
GRANT SELECT ON security_alerts TO service_role;

-- Step 7: Add comment for documentation
COMMENT ON POLICY "Users can update own metadata only" ON public.profiles IS 
  'Allows users to update their profile metadata but prevents modification of subscription fields. Subscription updates ONLY via webhooks.';

COMMENT ON POLICY "Service role can update subscriptions" ON public.profiles IS 
  'Allows service role (webhooks) to update subscription fields. This is the ONLY way to modify user tiers.';

COMMENT ON VIEW security_alerts IS 
  'Real-time security monitoring for suspicious subscription configurations. Check this view regularly for anomalies.';

-- Verification queries (run these after migration)
-- 1. Test that user CANNOT update their tier:
--    UPDATE profiles SET subscription_tier = 'studio' WHERE id = auth.uid();
--    Expected: Policy violation error
--
-- 2. Check for existing security alerts:
--    SELECT * FROM security_alerts;
--    Expected: No critical alerts on production
--
-- 3. Verify policies are active:
--    SELECT * FROM pg_policies WHERE tablename = 'profiles';
--    Expected: See both policies listed above

