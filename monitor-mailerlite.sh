#!/usr/bin/env bash
set -euo pipefail

echo "🔎 MailerLite Webhook Monitoring & Verification"
echo "================================================"

# Test email from our verification
TEST_EMAIL="verification-1757873445@demo.com"
echo "📧 Monitoring test email: $TEST_EMAIL"
echo ""

# 1. Create SQL query file for manual execution
echo "📊 Creating SQL query for manual execution..."
cat > sql_verification_query.sql << EOF
-- MailerLite Webhook Verification Query
-- Run this in Supabase SQL Editor

-- Check our test email
SELECT 
    email,
    subscription_tier,
    status,
    bounce_reason,
    updated_at,
    created_at
FROM profiles 
WHERE email = '$TEST_EMAIL'
ORDER BY updated_at DESC;

-- Check all recent test emails
SELECT 
    email,
    subscription_tier,
    status,
    bounce_reason,
    updated_at
FROM profiles 
WHERE email LIKE '%demo.com%' OR email LIKE '%test%'
ORDER BY updated_at DESC
LIMIT 10;

-- Check subscription tier distribution
SELECT 
    subscription_tier,
    COUNT(*) as count,
    MAX(updated_at) as latest_update
FROM profiles 
GROUP BY subscription_tier
ORDER BY count DESC;

-- Check status distribution
SELECT 
    status,
    COUNT(*) as count,
    MAX(updated_at) as latest_update
FROM profiles 
GROUP BY status
ORDER BY count DESC;
EOF

echo "✅ SQL query saved to: sql_verification_query.sql"
echo ""

# 2. Create webhook test script
echo "🧪 Creating webhook test script..."
cat > test-webhook-now.sh << 'EOF'
#!/bin/bash
echo "🧪 Testing MailerLite webhook right now..."
TEST_EMAIL="monitor-$(date +%s)@demo.com"
echo "📧 Test email: $TEST_EMAIL"

# Test subscriber.created
BODY='{"type":"subscriber.created","data":{"email":"'$TEST_EMAIL'","fields":{"plan":"premium","name":"Monitor Test"}}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "wAGDBZzeJK" -binary | base64)

echo "📤 Sending subscriber.created event..."
curl -s -w "\n%{http_code}" -X POST "https://rbwabemtucdkytvvpzvk.supabase.co/functions/v1/mailerWebhook" \
  -H "Content-Type: application/json" \
  -H "x-mailerlite-signature: $SIGNATURE" \
  -d "$BODY"

echo ""
echo "✅ Test completed! Check Supabase Dashboard for logs and run SQL query."
EOF

chmod +x test-webhook-now.sh
echo "✅ Webhook test script saved to: test-webhook-now.sh"
echo ""

# 3. Display verification steps
echo "📋 VERIFICATION STEPS:"
echo "======================"
echo ""
echo "1️⃣ MANUAL SQL VERIFICATION:"
echo "   • Go to: https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/sql"
echo "   • Copy and paste the contents of: sql_verification_query.sql"
echo "   • Run the query to see profile updates"
echo ""
echo "2️⃣ CHECK WEBHOOK LOGS:"
echo "   • Go to: https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/functions"
echo "   • Click on 'mailerWebhook' function"
echo "   • Go to 'Logs' tab"
echo "   • Look for structured JSON logs with our test email"
echo ""
echo "3️⃣ RUN LIVE TEST:"
echo "   • Execute: ./test-webhook-now.sh"
echo "   • This will send a new webhook event"
echo "   • Check logs immediately after"
echo ""
echo "4️⃣ EXPECTED RESULTS:"
echo "   • SQL: Should show profile with subscription_tier='premium'"
echo "   • Logs: Should show INFO level logs with structured JSON"
echo "   • Response: All webhooks should return {'received':true}"
echo ""

# 4. Show recent test summary
echo "📊 RECENT TEST SUMMARY:"
echo "======================="
echo "✅ Webhook Events Tested:"
echo "   • subscriber.created (premium plan)"
echo "   • subscriber.bounced (inactive status)"
echo "   • All events returned HTTP 200"
echo "   • All events returned {'received':true}"
echo ""
echo "🔍 Test Emails Used:"
echo "   • test-1757873373@demo.com (comprehensive test)"
echo "   • verification-1757873445@demo.com (detailed verification)"
echo ""
echo "🎯 Next: Run the verification steps above to confirm database updates!"
