#!/usr/bin/env bash
set -euo pipefail

SUPABASE_URL="https://rbwabemtucdkytvvpzvk.supabase.co"
FUNCTION_URL="$SUPABASE_URL/functions/v1/mailerWebhook"

# Read secrets from environment variables
export ANON_KEY="${ANON_KEY:?Missing ANON_KEY environment variable}"
export MAILERLITE_SIGNING_SECRET="${MAILERLITE_SIGNING_SECRET:?Missing MAILERLITE_SIGNING_SECRET environment variable}"

TEST_EMAIL="test@example.com"
GROUP_NAME="premium_monthly"

echo "🧪 Comprehensive MailerLite Webhook Test"
echo "========================================"

# Test 1: Valid webhook
echo "Test 1: Valid webhook with correct signature and auth"
TIMESTAMP=$(date +%s)
PAYLOAD=$(jq -n \
  --arg email "$TEST_EMAIL" \
  --arg group "$GROUP_NAME" \
  --arg type "subscriber.added_to_group" \
  --arg ts "$TIMESTAMP" \
  '{ type: $type, data: { email: $email, group: { name: $group } }, timestamp: $ts }')

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$MAILERLITE_SIGNING_SECRET" | cut -d " " -f2)

echo "📤 Payload: $PAYLOAD"
echo "🔐 Signature: $SIGNATURE"
echo "⏰ Timestamp: $TIMESTAMP"

RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "x-mailerlite-signature: $SIGNATURE" \
  -H "x-mailerlite-timestamp: $TIMESTAMP" \
  -d "$PAYLOAD")

echo "📥 Response: $RESPONSE"

# Test 2: Invalid signature
echo
echo "Test 2: Invalid signature (should fail)"
INVALID_SIGNATURE="invalid-signature"
RESPONSE2=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "x-mailerlite-signature: $INVALID_SIGNATURE" \
  -H "x-mailerlite-timestamp: $TIMESTAMP" \
  -d "$PAYLOAD")

echo "📥 Response: $RESPONSE2"

# Test 3: Expired timestamp
echo
echo "Test 3: Expired timestamp (should fail)"
EXPIRED_TIMESTAMP=$(( $(date +%s) - 600 )) # 10 minutes ago
RESPONSE3=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "x-mailerlite-signature: $SIGNATURE" \
  -H "x-mailerlite-timestamp: $EXPIRED_TIMESTAMP" \
  -d "$PAYLOAD")

echo "📥 Response: $RESPONSE3"

echo
echo "🎉 All tests completed!"
echo "Check Supabase dashboard for webhook_logs and function logs."
