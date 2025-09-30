-- =====================================================
-- ATLAS SUPABASE SCHEMA FIXES
-- =====================================================
-- Run these commands in your Supabase SQL Editor
-- This will fix the "column conversations.pinned does not exist" error

-- =====================================================
-- 1. ADD MISSING COLUMNS TO CONVERSATIONS TABLE
-- =====================================================

-- Add pinned column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' 
        AND column_name = 'pinned'
    ) THEN
        ALTER TABLE conversations ADD COLUMN pinned BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added pinned column to conversations table';
    ELSE
        RAISE NOTICE 'pinned column already exists in conversations table';
    END IF;
END $$;

-- Add is_archived column if it doesn't exist (for future use)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' 
        AND column_name = 'is_archived'
    ) THEN
        ALTER TABLE conversations ADD COLUMN is_archived BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_archived column to conversations table';
    ELSE
        RAISE NOTICE 'is_archived column already exists in conversations table';
    END IF;
END $$;

-- =====================================================
-- 2. VERIFY COLUMNS EXIST
-- =====================================================

-- Check the current schema of conversations table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- =====================================================
-- 3. TEST THE FIX
-- =====================================================

-- Test that we can now access the pinned column
SELECT id, title, pinned, is_archived, created_at, updated_at
FROM conversations 
LIMIT 5;

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. Run this script in your Supabase SQL Editor
-- 2. This will add the missing columns safely
-- 3. After running, restart your app and test conversation loading
-- 4. The error should be resolved



