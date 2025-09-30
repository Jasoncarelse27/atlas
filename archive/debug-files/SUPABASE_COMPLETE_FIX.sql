-- =====================================================
-- ATLAS SUPABASE COMPLETE SCHEMA FIX
-- =====================================================
-- Run this in your Supabase SQL Editor to fix ALL database errors

-- =====================================================
-- 1. FIX CONVERSATIONS TABLE
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

-- Add is_archived column if it doesn't exist
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
-- 2. FIX MESSAGES TABLE (if it exists)
-- =====================================================

-- Check if messages table exists and add role column
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'messages'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'messages' 
            AND column_name = 'role'
        ) THEN
            ALTER TABLE messages ADD COLUMN role TEXT DEFAULT 'user';
            RAISE NOTICE 'Added role column to messages table';
        ELSE
            RAISE NOTICE 'role column already exists in messages table';
        END IF;
    ELSE
        RAISE NOTICE 'messages table does not exist - using webhook_logs instead';
    END IF;
END $$;

-- =====================================================
-- 3. FIX WEBHOOK_LOGS TABLE
-- =====================================================

-- Add role column to webhook_logs if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'webhook_logs' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE webhook_logs ADD COLUMN role TEXT DEFAULT 'user';
        RAISE NOTICE 'Added role column to webhook_logs table';
    ELSE
        RAISE NOTICE 'role column already exists in webhook_logs table';
    END IF;
END $$;

-- =====================================================
-- 4. VERIFY ALL FIXES
-- =====================================================

-- Check conversations table schema
SELECT 'conversations' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- Check webhook_logs table schema
SELECT 'webhook_logs' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'webhook_logs'
ORDER BY ordinal_position;

-- =====================================================
-- 5. TEST QUERIES
-- =====================================================

-- Test conversations table
SELECT id, title, pinned, is_archived, created_at, updated_at
FROM conversations 
LIMIT 3;

-- Test webhook_logs table
SELECT id, role, payload, timestamp, conversation_id
FROM webhook_logs 
LIMIT 3;



