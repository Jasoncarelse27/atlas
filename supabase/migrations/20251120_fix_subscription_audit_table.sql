-- Migration: Fix subscription_audit table to match backend expectations
-- This ensures IAP idempotency checks work correctly
-- Created: 2025-11-20

-- Drop conflicting table if it exists with wrong schema
DROP TABLE IF EXISTS public.subscription_audit CASCADE;

-- Create subscription_audit table with correct schema (matches backend/server.mjs)
CREATE TABLE IF NOT EXISTS public.subscription_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'activation',
    'cancellation', 
    'upgrade',
    'downgrade',
    'subscription.activated',
    'subscription.canceled',
    'subscription.updated'
  )),
  old_tier text CHECK (old_tier IN ('free', 'core', 'studio')),
  new_tier text NOT NULL CHECK (new_tier IN ('free', 'core', 'studio')),
  provider text DEFAULT 'fastspring', -- 'fastspring', 'app_store', 'manual', 'system'
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance (especially for idempotency checks)
CREATE INDEX IF NOT EXISTS idx_subscription_audit_profile_id ON public.subscription_audit(profile_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_event_type ON public.subscription_audit(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_created_at ON public.subscription_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_tiers ON public.subscription_audit(old_tier, new_tier);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_provider ON public.subscription_audit(provider);

-- ✅ CRITICAL: Index for idempotency checks (metadata->>'transaction_id')
CREATE INDEX IF NOT EXISTS idx_subscription_audit_metadata_transaction 
  ON public.subscription_audit USING gin ((metadata->>'transaction_id'));

-- Enable RLS
ALTER TABLE public.subscription_audit ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for webhooks and backend API)
CREATE POLICY "Service role full access" ON public.subscription_audit
  FOR ALL USING (auth.role() = 'service_role');

-- Users can read their own audit history
CREATE POLICY "Users can read own audit history" ON public.subscription_audit
  FOR SELECT USING (auth.uid() = profile_id);

-- Function to log subscription changes (updated to match backend expectations)
CREATE OR REPLACE FUNCTION log_subscription_change(
  p_profile_id uuid,
  p_event_type text,
  p_old_tier text,
  p_new_tier text,
  p_provider text DEFAULT 'manual',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.subscription_audit (
    profile_id,
    event_type,
    old_tier,
    new_tier,
    provider,
    metadata
  ) VALUES (
    p_profile_id,
    p_event_type,
    p_old_tier,
    p_new_tier,
    p_provider,
    p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically log subscription changes from profiles table
CREATE OR REPLACE FUNCTION trigger_log_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if tier actually changed
  IF OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier THEN
    PERFORM log_subscription_change(
      NEW.id,
      'subscription.updated',
      OLD.subscription_tier,
      NEW.subscription_tier,
      'system',
      jsonb_build_object(
        'updated_by', 'system',
        'reason', 'profile_update',
        'timestamp', NOW()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trigger_log_subscription_change ON public.profiles;
CREATE TRIGGER trigger_log_subscription_change
  AFTER UPDATE OF subscription_tier ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_subscription_change();

-- Grant necessary permissions
GRANT SELECT ON public.subscription_audit TO authenticated;
GRANT INSERT ON public.subscription_audit TO service_role;
GRANT SELECT ON public.subscription_audit TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.subscription_audit IS 'Tracks all subscription tier changes for analytics, audit, and idempotency checks. Used by IAP endpoint to prevent duplicate transactions.';
COMMENT ON COLUMN public.subscription_audit.metadata IS 'JSONB field storing transaction_id, platform, receipt_preview, and other event-specific data';
COMMENT ON COLUMN public.subscription_audit.provider IS 'Payment provider: fastspring, app_store, manual, or system';

