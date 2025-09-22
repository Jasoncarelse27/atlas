-- 🚨 Rollback: remove anon signup policy (for production hardening)
-- This migration reverts the temporary anon signup policy once SMTP email confirmations are enabled

BEGIN;

-- Drop the anon signup policy
DROP POLICY IF EXISTS "Allow anon signup" ON auth.users;

-- Restore stricter defaults:
-- Only authenticated users can insert into auth.users (handled by Supabase internally)
-- Keep SELECT self policy for safety
DROP POLICY IF EXISTS "Allow select own user" ON auth.users;
CREATE POLICY "Allow select own user"
ON auth.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

COMMIT;

-- =======================================================
-- 📋 Usage Instructions
-- =======================================================
-- Run during production hardening, once SMTP email confirmations are enabled.
-- 
-- Command to apply rollback:
-- git add supabase/migrations/20250922_rollback_auth_signup.sql
-- git commit -m "revert(auth): remove anon signup policy, enforce SMTP confirmations"
-- git push
-- supabase db push
-- 
-- =======================================================
-- ✅ Expected Flow
-- =======================================================
-- Now (dev phase): 20250922_fix_auth_signup.sql → anon signups allowed.
-- Later (prod phase): 20250922_rollback_auth_signup.sql → anon signups disabled, enforce proper email confirmations.
-- 
-- This gives you a clean migration trail:
-- - One file enables anon signups temporarily.
-- - Another file reverts it when you're ready for production.
