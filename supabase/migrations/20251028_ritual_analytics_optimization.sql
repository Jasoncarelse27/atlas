-- =====================================================
-- Ritual Analytics Optimization
-- Created: October 28, 2025
-- Purpose: Add composite index for faster analytics queries
-- =====================================================

-- Add composite index for analytics date range queries
-- This speeds up queries like "get all my completions in last 30 days"
CREATE INDEX IF NOT EXISTS idx_ritual_logs_user_completed 
  ON ritual_logs(user_id, completed_at DESC);

-- Add index for mood analysis queries
CREATE INDEX IF NOT EXISTS idx_ritual_logs_moods
  ON ritual_logs(user_id, mood_before, mood_after);

-- Add index for ritual popularity analysis
CREATE INDEX IF NOT EXISTS idx_ritual_logs_ritual_completed
  ON ritual_logs(ritual_id, completed_at DESC);

-- =====================================================
-- NOTES
-- =====================================================
-- These indexes significantly improve performance for:
-- 1. User completion history queries (dashboard)
-- 2. Mood trend analysis over time
-- 3. Popular ritual identification
-- 4. Streak calculation queries
-- =====================================================

