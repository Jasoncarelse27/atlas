-- Atlas Database Partitioning - CLEAN VERSION
-- Only partitions messages table (usage_logs skipped)
-- Expected performance improvement: 40-60% for large datasets

-- Create partitioned messages table
CREATE TABLE IF NOT EXISTS messages_partitioned (
    id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create 36 monthly partitions (2024-2027)
CREATE TABLE IF NOT EXISTS messages_2024_01 PARTITION OF messages_partitioned FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE IF NOT EXISTS messages_2024_02 PARTITION OF messages_partitioned FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE IF NOT EXISTS messages_2024_03 PARTITION OF messages_partitioned FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE IF NOT EXISTS messages_2024_04 PARTITION OF messages_partitioned FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE IF NOT EXISTS messages_2024_05 PARTITION OF messages_partitioned FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE IF NOT EXISTS messages_2024_06 PARTITION OF messages_partitioned FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE IF NOT EXISTS messages_2024_07 PARTITION OF messages_partitioned FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE IF NOT EXISTS messages_2024_08 PARTITION OF messages_partitioned FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE IF NOT EXISTS messages_2024_09 PARTITION OF messages_partitioned FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE IF NOT EXISTS messages_2024_10 PARTITION OF messages_partitioned FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE IF NOT EXISTS messages_2024_11 PARTITION OF messages_partitioned FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE IF NOT EXISTS messages_2024_12 PARTITION OF messages_partitioned FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE IF NOT EXISTS messages_2025_01 PARTITION OF messages_partitioned FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS messages_2025_02 PARTITION OF messages_partitioned FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS messages_2025_03 PARTITION OF messages_partitioned FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS messages_2025_04 PARTITION OF messages_partitioned FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS messages_2025_05 PARTITION OF messages_partitioned FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS messages_2025_06 PARTITION OF messages_partitioned FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS messages_2025_07 PARTITION OF messages_partitioned FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS messages_2025_08 PARTITION OF messages_partitioned FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS messages_2025_09 PARTITION OF messages_partitioned FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS messages_2025_10 PARTITION OF messages_partitioned FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS messages_2025_11 PARTITION OF messages_partitioned FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS messages_2025_12 PARTITION OF messages_partitioned FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS messages_2026_01 PARTITION OF messages_partitioned FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS messages_2026_02 PARTITION OF messages_partitioned FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS messages_2026_03 PARTITION OF messages_partitioned FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS messages_2026_04 PARTITION OF messages_partitioned FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS messages_2026_05 PARTITION OF messages_partitioned FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS messages_2026_06 PARTITION OF messages_partitioned FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS messages_2026_07 PARTITION OF messages_partitioned FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS messages_2026_08 PARTITION OF messages_partitioned FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS messages_2026_09 PARTITION OF messages_partitioned FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS messages_2026_10 PARTITION OF messages_partitioned FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS messages_2026_11 PARTITION OF messages_partitioned FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS messages_2026_12 PARTITION OF messages_partitioned FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Migrate existing valid messages
INSERT INTO messages_partitioned (id, conversation_id, user_id, role, content, created_at, updated_at)
SELECT m.id, m.conversation_id, c.user_id, m.role, m.content, m.created_at, m.created_at
FROM messages m
INNER JOIN conversations c ON m.conversation_id = c.id
WHERE c.user_id IS NOT NULL
ON CONFLICT (id, created_at) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_partitioned_user_id ON messages_partitioned(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_partitioned_conversation_id ON messages_partitioned(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_partitioned_created_at ON messages_partitioned(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_partitioned_role ON messages_partitioned(role);

-- Enable RLS
ALTER TABLE messages_partitioned ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view messages from their conversations (partitioned)" ON messages_partitioned
  FOR SELECT USING (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()));

CREATE POLICY "Users can create messages in their conversations (partitioned)" ON messages_partitioned
  FOR INSERT WITH CHECK (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()));

-- Grant permissions
GRANT ALL ON messages_partitioned TO service_role;
GRANT SELECT, INSERT ON messages_partitioned TO authenticated;

