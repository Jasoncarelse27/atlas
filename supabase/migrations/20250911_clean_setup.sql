-- Clean setup for MailerLite webhook integration
-- Drop existing tables if they exist and recreate with correct schema

-- Drop existing webhook_logs table
DROP TABLE IF EXISTS webhook_logs CASCADE;

-- Create webhook_logs table with correct schema
CREATE TABLE webhook_logs (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  email TEXT,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  received_at TIMESTAMP DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_email TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for webhook_logs
CREATE INDEX idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX idx_webhook_logs_email ON webhook_logs(email);
CREATE INDEX idx_webhook_logs_received_at ON webhook_logs(received_at DESC);

-- Indexes for subscriptions
CREATE INDEX idx_subscriptions_user_email ON subscriptions(user_email);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
