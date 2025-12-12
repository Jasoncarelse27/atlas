-- ================================
-- Atlas Four-Agent Support System Schema
-- Milestone 1: Foundation (Zero Runtime Impact)
-- ================================
-- 
-- Creates tables for:
-- 1. Web Agent conversations
-- 2. Social Media insights and drafts
-- 3. Email threads and draft replies
-- 4. Support incidents (Escalation Agent)
-- 5. Agent notifications tracking
--
-- SAFETY: Pure additive schema - no modifications to existing tables
-- All tables use CREATE TABLE IF NOT EXISTS for idempotency
-- ================================

-- Enable RLS (if not already enabled)
ALTER DATABASE postgres SET row_security = on;

-- ================================
-- 1. WEB AGENT CONVERSATIONS
-- ================================
CREATE TABLE IF NOT EXISTS web_agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('rima_site', 'atlas_app')),
  user_message TEXT NOT NULL,
  agent_response TEXT,
  escalated BOOLEAN DEFAULT false,
  escalation_reason TEXT,
  incident_id UUID, -- FK added after support_incidents table exists
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for web_agent_conversations
CREATE INDEX IF NOT EXISTS idx_web_agent_conversations_user_created_at 
  ON web_agent_conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_agent_conversations_escalated 
  ON web_agent_conversations(escalated) WHERE escalated = true;
CREATE INDEX IF NOT EXISTS idx_web_agent_conversations_source_created_at 
  ON web_agent_conversations(source, created_at DESC);

-- ================================
-- 2. SOCIAL MEDIA INSIGHTS
-- ================================
CREATE TABLE IF NOT EXISTS social_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'youtube')),
  post_id TEXT,
  comment_id TEXT,
  author_name TEXT,
  author_id TEXT,
  content TEXT NOT NULL,
  classification TEXT CHECK (classification IN ('bug_report', 'billing_issue', 'feature_request', 'praise', 'spam', 'other')),
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  incident_id UUID, -- FK added after support_incidents table exists
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for social_insights
CREATE INDEX IF NOT EXISTS idx_social_insights_created_at 
  ON social_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_insights_classification 
  ON social_insights(classification);
CREATE INDEX IF NOT EXISTS idx_social_insights_platform_created_at 
  ON social_insights(platform, created_at DESC);

-- ================================
-- 3. SOCIAL DRAFT REPLIES
-- ================================
CREATE TABLE IF NOT EXISTS social_draft_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id UUID NOT NULL REFERENCES social_insights(id) ON DELETE CASCADE,
  draft_text TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sent')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for social_draft_replies
CREATE INDEX IF NOT EXISTS idx_social_draft_replies_insight_id 
  ON social_draft_replies(insight_id);
CREATE INDEX IF NOT EXISTS idx_social_draft_replies_status 
  ON social_draft_replies(status);

-- ================================
-- 4. EMAIL THREADS
-- ================================
CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_thread_id TEXT UNIQUE,
  gmail_message_id TEXT,
  mailbox TEXT NOT NULL CHECK (mailbox IN ('info', 'jason', 'rima')),
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  classification TEXT CHECK (classification IN ('support', 'billing', 'bug_report', 'partnership', 'spam', 'other')),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tier TEXT, -- Extracted from user profile if matched
  extracted_data JSONB DEFAULT '{}'::jsonb, -- Error codes, device info, etc.
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'classified', 'draft_generated', 'replied')),
  incident_id UUID, -- FK added after support_incidents table exists
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for email_threads
CREATE INDEX IF NOT EXISTS idx_email_threads_created_at 
  ON email_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_threads_status 
  ON email_threads(status);
CREATE INDEX IF NOT EXISTS idx_email_threads_mailbox_created_at 
  ON email_threads(mailbox, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_threads_gmail_thread_id 
  ON email_threads(gmail_thread_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_email_threads_updated_at ON email_threads;
CREATE TRIGGER trigger_update_email_threads_updated_at
  BEFORE UPDATE ON email_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_email_threads_updated_at();

-- ================================
-- 5. EMAIL DRAFT REPLIES
-- ================================
CREATE TABLE IF NOT EXISTS email_draft_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  draft_text TEXT NOT NULL,
  draft_html TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sent')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for email_draft_replies
CREATE INDEX IF NOT EXISTS idx_email_draft_replies_thread_id 
  ON email_draft_replies(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_draft_replies_status 
  ON email_draft_replies(status);

-- ================================
-- 6. SUPPORT INCIDENTS (Escalation Agent)
-- ================================
CREATE TABLE IF NOT EXISTS support_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('web', 'social', 'email', 'system')),
  source_id UUID, -- References source table (web_agent_conversations, social_insights, email_threads)
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'ignored')),
  tags TEXT[] DEFAULT '{}', -- Array: ['billing', 'bug', 'ux', 'churn_risk', etc.]
  short_summary TEXT NOT NULL,
  long_summary TEXT,
  suggested_actions TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for support_incidents
CREATE INDEX IF NOT EXISTS idx_support_incidents_status_created_at 
  ON support_incidents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_incidents_severity 
  ON support_incidents(severity) WHERE severity IN ('high', 'critical');
CREATE INDEX IF NOT EXISTS idx_support_incidents_source_source_id 
  ON support_incidents(source, source_id);
CREATE INDEX IF NOT EXISTS idx_support_incidents_user_id 
  ON support_incidents(user_id) WHERE user_id IS NOT NULL;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_support_incidents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_support_incidents_updated_at ON support_incidents;
CREATE TRIGGER trigger_update_support_incidents_updated_at
  BEFORE UPDATE ON support_incidents
  FOR EACH ROW
  EXECUTE FUNCTION update_support_incidents_updated_at();

-- ================================
-- 7. AGENT NOTIFICATIONS (Idempotency Tracking)
-- ================================
CREATE TABLE IF NOT EXISTS agent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES support_incidents(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  to_address TEXT NOT NULL, -- Email or phone number
  to_name TEXT,
  subject TEXT, -- For email only
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_notifications
CREATE INDEX IF NOT EXISTS idx_agent_notifications_status_created_at 
  ON agent_notifications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_incident_id 
  ON agent_notifications(incident_id);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_channel_status 
  ON agent_notifications(channel, status);

-- ================================
-- Add Foreign Key Constraints (after all tables exist)
-- ================================
-- Note: These are added after table creation to avoid dependency issues

-- Add FK from web_agent_conversations to support_incidents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_web_agent_conversations_incident_id'
  ) THEN
    ALTER TABLE web_agent_conversations
    ADD CONSTRAINT fk_web_agent_conversations_incident_id
    FOREIGN KEY (incident_id) REFERENCES support_incidents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add FK from social_insights to support_incidents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_social_insights_incident_id'
  ) THEN
    ALTER TABLE social_insights
    ADD CONSTRAINT fk_social_insights_incident_id
    FOREIGN KEY (incident_id) REFERENCES support_incidents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add FK from email_threads to support_incidents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_email_threads_incident_id'
  ) THEN
    ALTER TABLE email_threads
    ADD CONSTRAINT fk_email_threads_incident_id
    FOREIGN KEY (incident_id) REFERENCES support_incidents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ================================
-- Row Level Security (RLS) Policies
-- ================================

-- Enable RLS on all tables
ALTER TABLE web_agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_draft_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_draft_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_notifications ENABLE ROW LEVEL SECURITY;

-- ================================
-- RLS Policies: web_agent_conversations
-- Users can only see their own conversations
-- ================================
DO $$
BEGIN
  -- Users can view their own conversations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can view their own web agent conversations' 
    AND tablename = 'web_agent_conversations'
  ) THEN
    CREATE POLICY "Users can view their own web agent conversations" 
    ON web_agent_conversations
    FOR SELECT 
    USING (user_id = auth.uid() OR user_id IS NULL);
  END IF;

  -- Users can create their own conversations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can create their own web agent conversations' 
    AND tablename = 'web_agent_conversations'
  ) THEN
    CREATE POLICY "Users can create their own web agent conversations" 
    ON web_agent_conversations
    FOR INSERT 
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
  END IF;
END $$;

-- ================================
-- RLS Policies: Admin/Service Role Only Tables
-- These tables are for internal agent operations and admin dashboards
-- Only service_role can access (via backend/Edge Functions)
-- ================================

-- social_insights: Service role only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Service role can manage social insights' 
    AND tablename = 'social_insights'
  ) THEN
    CREATE POLICY "Service role can manage social insights" 
    ON social_insights
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- social_draft_replies: Service role only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Service role can manage social draft replies' 
    AND tablename = 'social_draft_replies'
  ) THEN
    CREATE POLICY "Service role can manage social draft replies" 
    ON social_draft_replies
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- email_threads: Service role only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Service role can manage email threads' 
    AND tablename = 'email_threads'
  ) THEN
    CREATE POLICY "Service role can manage email threads" 
    ON email_threads
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- email_draft_replies: Service role only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Service role can manage email draft replies' 
    AND tablename = 'email_draft_replies'
  ) THEN
    CREATE POLICY "Service role can manage email draft replies" 
    ON email_draft_replies
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- support_incidents: Service role only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Service role can manage support incidents' 
    AND tablename = 'support_incidents'
  ) THEN
    CREATE POLICY "Service role can manage support incidents" 
    ON support_incidents
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- agent_notifications: Service role only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Service role can manage agent notifications' 
    AND tablename = 'agent_notifications'
  ) THEN
    CREATE POLICY "Service role can manage agent notifications" 
    ON agent_notifications
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- ================================
-- Grant Permissions
-- ================================
-- Grant service_role full access to all tables
GRANT ALL ON web_agent_conversations TO service_role;
GRANT ALL ON social_insights TO service_role;
GRANT ALL ON social_draft_replies TO service_role;
GRANT ALL ON email_threads TO service_role;
GRANT ALL ON email_draft_replies TO service_role;
GRANT ALL ON support_incidents TO service_role;
GRANT ALL ON agent_notifications TO service_role;

-- Grant sequence permissions (for UUID generation)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ================================
-- Rollback Plan (Manual Execution)
-- ================================
-- If Milestone 1 needs to be rolled back, execute these in reverse order:
--
-- DROP TABLE IF EXISTS agent_notifications;
-- DROP TABLE IF EXISTS support_incidents;
-- DROP TABLE IF EXISTS email_draft_replies;
-- DROP TABLE IF EXISTS email_threads;
-- DROP TABLE IF EXISTS social_draft_replies;
-- DROP TABLE IF EXISTS social_insights;
-- DROP TABLE IF EXISTS web_agent_conversations;
--
-- Also drop functions:
-- DROP FUNCTION IF EXISTS update_email_threads_updated_at();
-- DROP FUNCTION IF EXISTS update_support_incidents_updated_at();
-- ================================










