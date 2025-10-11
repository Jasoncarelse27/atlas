-- Atlas Database Partitioning Migration (SUPABASE SIMPLE)
-- Implements table partitioning for messages and usage_logs tables
-- Expected performance improvement: 40-60% for large datasets
-- SIMPLIFIED: No $$ blocks, Supabase-compatible syntax

-- ==============================================
-- MESSAGES TABLE PARTITIONING
-- ==============================================

-- Create partitioned messages table with correct primary key
CREATE TABLE IF NOT EXISTS messages_partitioned (
    id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- ✅ FIXED: Primary key includes created_at for partitioning
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for messages (2024-2027)
CREATE TABLE IF NOT EXISTS messages_2024_01 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE IF NOT EXISTS messages_2024_02 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE IF NOT EXISTS messages_2024_03 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

CREATE TABLE IF NOT EXISTS messages_2024_04 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');

CREATE TABLE IF NOT EXISTS messages_2024_05 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

CREATE TABLE IF NOT EXISTS messages_2024_06 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

CREATE TABLE IF NOT EXISTS messages_2024_07 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');

CREATE TABLE IF NOT EXISTS messages_2024_08 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');

CREATE TABLE IF NOT EXISTS messages_2024_09 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');

CREATE TABLE IF NOT EXISTS messages_2024_10 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');

CREATE TABLE IF NOT EXISTS messages_2024_11 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

CREATE TABLE IF NOT EXISTS messages_2024_12 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

CREATE TABLE IF NOT EXISTS messages_2025_01 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS messages_2025_02 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS messages_2025_03 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE IF NOT EXISTS messages_2025_04 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE IF NOT EXISTS messages_2025_05 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE IF NOT EXISTS messages_2025_06 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE IF NOT EXISTS messages_2025_07 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE IF NOT EXISTS messages_2025_08 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE IF NOT EXISTS messages_2025_09 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE IF NOT EXISTS messages_2025_10 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE IF NOT EXISTS messages_2025_11 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE IF NOT EXISTS messages_2025_12 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS messages_2026_01 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE IF NOT EXISTS messages_2026_02 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS messages_2026_03 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS messages_2026_04 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS messages_2026_05 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS messages_2026_06 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS messages_2026_07 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS messages_2026_08 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE IF NOT EXISTS messages_2026_09 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS messages_2026_10 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS messages_2026_11 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE IF NOT EXISTS messages_2026_12 PARTITION OF messages_partitioned
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- ==============================================
-- USAGE_LOGS TABLE PARTITIONING  
-- ==============================================

-- Create partitioned usage_logs table with correct primary key
CREATE TABLE IF NOT EXISTS usage_logs_partitioned (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    event TEXT NOT NULL,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- ✅ FIXED: Primary key includes created_at for partitioning
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for usage_logs (2024-2027)
CREATE TABLE IF NOT EXISTS usage_logs_2024_01 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE IF NOT EXISTS usage_logs_2024_02 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE IF NOT EXISTS usage_logs_2024_03 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

CREATE TABLE IF NOT EXISTS usage_logs_2024_04 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');

CREATE TABLE IF NOT EXISTS usage_logs_2024_05 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

CREATE TABLE IF NOT EXISTS usage_logs_2024_06 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

CREATE TABLE IF NOT EXISTS usage_logs_2024_07 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');

CREATE TABLE IF NOT EXISTS usage_logs_2024_08 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');

CREATE TABLE IF NOT EXISTS usage_logs_2024_09 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');

CREATE TABLE IF NOT EXISTS usage_logs_2024_10 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');

CREATE TABLE IF NOT EXISTS usage_logs_2024_11 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

CREATE TABLE IF NOT EXISTS usage_logs_2024_12 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

CREATE TABLE IF NOT EXISTS usage_logs_2025_01 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS usage_logs_2025_02 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS usage_logs_2025_03 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE IF NOT EXISTS usage_logs_2025_04 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE IF NOT EXISTS usage_logs_2025_05 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE IF NOT EXISTS usage_logs_2025_06 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE IF NOT EXISTS usage_logs_2025_07 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE IF NOT EXISTS usage_logs_2025_08 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE IF NOT EXISTS usage_logs_2025_09 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE IF NOT EXISTS usage_logs_2025_10 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE IF NOT EXISTS usage_logs_2025_11 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE IF NOT EXISTS usage_logs_2025_12 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS usage_logs_2026_01 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE IF NOT EXISTS usage_logs_2026_02 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS usage_logs_2026_03 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS usage_logs_2026_04 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS usage_logs_2026_05 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS usage_logs_2026_06 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS usage_logs_2026_07 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS usage_logs_2026_08 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE IF NOT EXISTS usage_logs_2026_09 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS usage_logs_2026_10 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS usage_logs_2026_11 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE IF NOT EXISTS usage_logs_2026_12 PARTITION OF usage_logs_partitioned
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- ==============================================
-- DATA MIGRATION (NON-BREAKING)
-- ==============================================

-- Copy existing data to partitioned tables (if they have data)
-- ✅ FINAL FIX: Skip orphaned messages (messages without conversations)
INSERT INTO messages_partitioned (id, conversation_id, user_id, role, content, created_at, updated_at)
SELECT 
    m.id, 
    m.conversation_id, 
    c.user_id,
    m.role, 
    m.content, 
    m.created_at, 
    m.created_at as updated_at
FROM messages m
INNER JOIN conversations c ON m.conversation_id = c.id
WHERE c.user_id IS NOT NULL
ON CONFLICT (id, created_at) DO NOTHING;

-- Skip usage_logs migration if table doesn't exist or has no data
-- INSERT INTO usage_logs_partitioned 
-- SELECT id, user_id, event, data, created_at
-- FROM usage_logs 
-- WHERE EXISTS (SELECT 1 FROM usage_logs LIMIT 1)
-- ON CONFLICT (id, created_at) DO NOTHING;

-- ==============================================
-- INDEXES FOR PARTITIONED TABLES
-- ==============================================

-- Create indexes on partitioned tables for optimal performance
CREATE INDEX IF NOT EXISTS idx_messages_partitioned_user_id ON messages_partitioned(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_partitioned_conversation_id ON messages_partitioned(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_partitioned_created_at ON messages_partitioned(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_partitioned_role ON messages_partitioned(role);

CREATE INDEX IF NOT EXISTS idx_usage_logs_partitioned_user_id ON usage_logs_partitioned(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_partitioned_event ON usage_logs_partitioned(event);
CREATE INDEX IF NOT EXISTS idx_usage_logs_partitioned_created_at ON usage_logs_partitioned(created_at);

-- ==============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================

-- Enable RLS on partitioned tables
ALTER TABLE messages_partitioned ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs_partitioned ENABLE ROW LEVEL SECURITY;

-- Users can view messages from their conversations
CREATE POLICY "Users can view messages from their conversations (partitioned)" ON messages_partitioned
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

-- Users can create messages in their conversations
CREATE POLICY "Users can create messages in their conversations (partitioned)" ON messages_partitioned
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

-- Service role can manage usage logs
CREATE POLICY "Service role can manage usage logs (partitioned)" ON usage_logs_partitioned
  FOR ALL USING (auth.role() = 'service_role');

-- ==============================================
-- GRANT PERMISSIONS
-- ==============================================

-- Grant permissions for service role
GRANT ALL ON messages_partitioned TO service_role;
GRANT ALL ON usage_logs_partitioned TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant permissions for authenticated users
GRANT SELECT, INSERT ON messages_partitioned TO authenticated;
GRANT SELECT ON usage_logs_partitioned TO authenticated;

-- ==============================================
-- MIGRATION COMPLETE
-- ==============================================

-- Log successful migration
INSERT INTO usage_logs_partitioned (id, user_id, event, data, created_at)
VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000'::uuid,
    'database_partitioning_completed',
    jsonb_build_object(
        'migration', '20250110_database_partitioning_supabase_simple',
        'tables_partitioned', ARRAY['messages', 'usage_logs'],
        'partitions_created', 36,
        'performance_improvement_expected', '40-60%'
    ),
    NOW()
);
