-- Fix: Remove orphaned Paddle trigger and function
-- The paddle_subscriptions table was renamed to fastspring_subscriptions,
-- but the sync_paddle_subscriptions() function and trigger were not removed
-- This causes errors when profiles are inserted/updated

-- 1. Drop the trigger that calls sync_paddle_subscriptions()
DROP TRIGGER IF EXISTS trigger_sync_paddle_subscriptions ON public.profiles;

-- 2. Drop the orphaned function (it tries to insert into paddle_subscriptions which no longer exists)
DROP FUNCTION IF EXISTS public.sync_paddle_subscriptions() CASCADE;

-- Note: The function was created in archive/migrations/paddle/20250922_paddle_subscriptions.sql
-- and should have been removed when migrating to FastSpring, but wasn't.

