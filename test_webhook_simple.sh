#!/usr/bin/env bash
set -euo pipefail

# ----------------------------
# CONFIG
# ----------------------------
SUPABASE_URL="https://rbwabemtucdkytvvpzvk.supabase.co"
FUNCTION_URL="$SUPABASE_URL/functions/v1/mailerWebhook"
MAILERLITE_SIGNING_SECRET=${MAILERLITE_SIGNING_SECRET:-"your-actual-secret"}

TEST_EMAIL="test@example.com"
GROUP_NAME="premium_monthly"

# ----------------------------
# FUNCTION: Send Test Event
# ----------------------------
send_test_event() {
  local EVENT_TYPE=$1
  local TIMESTAMP=$(date +%s)

  echo "🧪 Testing $EVENT_TYPE..."

  # Build payload
  local PAYLOAD=$(jq -n \
    --arg email "$TEST_EMAIL" \
    --arg group "$GROUP_NAME" \
    --arg type "$EVENT_TYPE" \
    --arg ts "$TIMESTAMP" \
    '{ type: $type, data: { email: $email, group: { name: $group } }, timestamp: $ts }')

  # Generate signature
  local SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$MAILERLITE_SIGNING_SECRET" | cut -d " " -f2)

  echo "📤 Payload: $PAYLOAD"
  echo "🔐 Signature: $SIGNATURE"
  echo "⏰ Timestamp: $TIMESTAMP"

  # Send request
  echo "🚀 Sending to $FUNCTION_URL..."
  local RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -H "x-mailerlite-signature: $SIGNATURE" \
    -H "x-mailerlite-timestamp: $TIMESTAMP" \
    -d "$PAYLOAD")

  echo "📥 Response: $RESPONSE"
  echo "✅ Test completed for $EVENT_TYPE"
  echo "----------------------------------------"
}

# ----------------------------
# Test Cases
# ----------------------------
echo "🧪 Starting MailerLite Webhook Tests"
echo "========================================"

# Test 1: Valid signature and timestamp
echo "Test 1: Valid webhook with correct signature"
send_test_event "subscriber.added_to_group"

echo
echo "Test 2: Invalid signature (should fail)"
TIMESTAMP=$(date +%s)
PAYLOAD=$(jq -n --arg email "$TEST_EMAIL" --arg group "$GROUP_NAME" '{ type: "subscriber.added_to_group", data: { email: $email, group: { name: $group } } }')
INVALID_SIGNATURE="invalid-signature"

echo "🚀 Sending with invalid signature..."
curl -s -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "x-mailerlite-signature: $INVALID_SIGNATURE" \
  -H "x-mailerlite-timestamp: $TIMESTAMP" \
  -d "$PAYLOAD" | jq .

echo
echo "Test 3: Expired timestamp (should fail)"
EXPIRED_TIMESTAMP=$(( $(date +%s) - 600 )) # 10 minutes ago
PAYLOAD=$(jq -n --arg email "$TEST_EMAIL" --arg group "$GROUP_NAME" '{ type: "subscriber.added_to_group", data: { email: $email, group: { name: $group } } }')
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$MAILERLITE_SIGNING_SECRET" | cut -d " " -f2)

echo "🚀 Sending with expired timestamp..."
curl -s -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "x-mailerlite-signature: $SIGNATURE" \
  -H "x-mailerlite-timestamp: $EXPIRED_TIMESTAMP" \
  -d "$PAYLOAD" | jq .

echo
echo "🎉 Webhook security tests completed!"
echo "Check Supabase dashboard for webhook_logs entries."
