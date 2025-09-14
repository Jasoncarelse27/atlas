#!/bin/bash
set -euo pipefail

echo "🔍 Atlas Migration Verification Script"
echo "======================================"

# Test email from migration
TEST_EMAIL="test-1757876669987@demo.com"

echo "📧 Test email: $TEST_EMAIL"
echo ""

echo "1️⃣ Verifying database schema..."
echo "Run this SQL in Supabase SQL Editor:"
echo "https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/sql"
echo ""
cat << 'EOF'

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('subscription_tier','status','bounce_reason')
ORDER BY column_name;

EOF

echo ""
echo "2️⃣ Verifying test email processing..."
echo "Run this SQL in Supabase SQL Editor:"
echo ""
cat << 'EOF'

SELECT email, subscription_tier, status, bounce_reason, updated_at
FROM profiles
WHERE email = 'test-1757876669987@demo.com'
ORDER BY updated_at DESC;

EOF

echo ""
echo "3️⃣ Verifying indexes..."
echo "Run this SQL in Supabase SQL Editor:"
echo ""
cat << 'EOF'

SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'profiles' 
AND indexname LIKE 'idx_profiles_%'
ORDER BY indexname;

EOF

echo ""
echo "4️⃣ Expected Results:"
echo "===================="
echo "Schema: subscription_tier, status, bounce_reason columns should exist"
echo "Test Email: subscription_tier should be 'premium'"
echo "Indexes: idx_profiles_subscription_tier, idx_profiles_status should exist"
echo ""
echo "5️⃣ Check Webhook Logs:"
echo "======================"
echo "Go to: https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/functions/mailerWebhook"
echo "Click on 'Logs' tab"
echo "Look for structured JSON logs with email: $TEST_EMAIL"
echo ""
echo "✅ Verification complete!"
