#!/usr/bin/env bash
set -euo pipefail

echo "🧪 Testing Schema and MailerLite Webhook Integration"
echo "===================================================="

# Test email for verification
TEST_EMAIL="schema-test-$(date +%s)@demo.com"
echo "📧 Test email: $TEST_EMAIL"
echo ""

# 1. Test webhook with new schema
echo "1️⃣ Testing webhook with new schema..."
BODY='{"type":"subscriber.created","data":{"email":"'$TEST_EMAIL'","fields":{"plan":"premium","name":"Schema Test"}}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "${MAILERLITE_SECRET}" -binary | base64)

echo "📤 Sending subscriber.created event..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${SUPABASE_URL}/functions/v1/mailerWebhook" \
  -H "Content-Type: application/json" \
  -H "x-mailerlite-signature: $SIGNATURE" \
  -d "$BODY")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Webhook Response: $RESPONSE_BODY"
    echo "✅ HTTP Status: $HTTP_CODE"
else
    echo "❌ Webhook Failed ($HTTP_CODE): $RESPONSE_BODY"
fi
echo ""

# 2. Test subscriber.bounced event
echo "2️⃣ Testing subscriber.bounced event..."
BODY2='{"type":"subscriber.bounced","data":{"email":"'$TEST_EMAIL'","reason":"mailbox_full","bounce_type":"hard"}}'
SIGNATURE2=$(echo -n "$BODY2" | openssl dgst -sha256 -hmac "${MAILERLITE_SECRET}" -binary | base64)

echo "📤 Sending subscriber.bounced event..."
RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST "${SUPABASE_URL}/functions/v1/mailerWebhook" \
  -H "Content-Type: application/json" \
  -H "x-mailerlite-signature: $SIGNATURE2" \
  -d "$BODY2")

HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)
RESPONSE_BODY2=$(echo "$RESPONSE2" | sed '$d')

if [ "$HTTP_CODE2" = "200" ]; then
    echo "✅ Webhook Response: $RESPONSE_BODY2"
    echo "✅ HTTP Status: $HTTP_CODE2"
else
    echo "❌ Webhook Failed ($HTTP_CODE2): $RESPONSE_BODY2"
fi
echo ""

# 3. Create SQL verification query
echo "3️⃣ Creating SQL verification query..."
cat > verify-schema-test.sql << EOF
-- Verify schema test results
-- Run this in Supabase SQL Editor after applying migration

-- Check if columns exist
SELECT 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('subscription_tier', 'status', 'bounce_reason')
ORDER BY column_name;

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

-- Check recent test emails
SELECT 
    email,
    subscription_tier,
    status,
    bounce_reason,
    updated_at
FROM profiles 
WHERE email LIKE '%schema-test%' OR email LIKE '%demo.com%'
ORDER BY updated_at DESC
LIMIT 10;
EOF

echo "✅ SQL verification query saved to: verify-schema-test.sql"
echo ""

# 4. Display next steps
echo "📋 NEXT STEPS:"
echo "=============="
echo ""
echo "1️⃣ APPLY MIGRATION:"
echo "   • Go to: https://supabase.com/dashboard/project/your-project/sql"
echo "   • Copy and paste contents of: apply-migration-manually.sql"
echo "   • Run the migration to add subscription columns"
echo ""
echo "2️⃣ VERIFY SCHEMA:"
echo "   • Run the verification query in: verify-schema-test.sql"
echo "   • Confirm columns exist: subscription_tier, status, bounce_reason"
echo ""
echo "3️⃣ CHECK WEBHOOK LOGS:"
echo "   • Go to: https://supabase.com/dashboard/project/your-project/functions"
echo "   • Click on 'mailerWebhook' function → 'Logs' tab"
echo "   • Look for structured JSON logs with test email: $TEST_EMAIL"
echo ""
echo "4️⃣ EXPECTED RESULTS:"
echo "   • Schema: subscription_tier='premium', status='inactive', bounce_reason='mailbox_full'"
echo "   • Logs: INFO level logs showing successful processing"
echo "   • Webhook: All events return {'received':true} with HTTP 200"
echo ""

echo "🎯 Test completed! Apply migration and verify results."
