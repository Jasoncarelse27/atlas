-- Create subscriptions table for MailerLite webhook integration
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_email TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups by email
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_email ON subscriptions(user_email);

-- Index for filtering by tier
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
