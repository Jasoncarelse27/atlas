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
