-- Test migration to ensure CI passes
-- This creates a simple table for testing purposes

CREATE TABLE IF NOT EXISTS test_table (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add a comment
COMMENT ON TABLE test_table IS 'Test table for CI validation';
