#!/usr/bin/env bash
set -euo pipefail

SUPABASE_URL="https://rbwabemtucdkytvvpzvk.supabase.co"
FUNCTION_URL="$SUPABASE_URL/functions/v1/mailerWebhook"

# Read secrets from environment variables
export ANON_KEY="${ANON_KEY:?Missing ANON_KEY environment variable}"
export MAILERLITE_SIGNING_SECRET="${MAILERLITE_SIGNING_SECRET:?Missing MAILERLITE_SIGNING_SECRET environment variable}"

TEST_EMAIL="test@example.com"
GROUP_NAME="premium_monthly"

send_test_event() {
  local EVENT_TYPE=$1
  local TIMESTAMP=$(date +%s)

  echo "🧪 Testing $EVENT_TYPE..."

  local PAYLOAD=$(jq -n \
    --arg email "$TEST_EMAIL" \
    --arg group "$GROUP_NAME" \
    --arg type "$EVENT_TYPE" \
    --arg ts "$TIMESTAMP" \
    '{ type: $type, data: { email: $email, group: { name: $group } }, timestamp: $ts }')

  local SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$MAILERLITE_SIGNING_SECRET" | cut -d " " -f2)

  echo "🚀 Sending to $FUNCTION_URL..."
  local RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "x-mailerlite-signature: $SIGNATURE" \
    -H "x-mailerlite-timestamp: $TIMESTAMP" \
    -d "$PAYLOAD")

  echo "📥 Response: $RESPONSE"
  echo "✅ Test completed for $EVENT_TYPE"
  echo "----------------------------------------"
}

echo "🧪 Testing with Authorization Header"
send_test_event "subscriber.added_to_group"
