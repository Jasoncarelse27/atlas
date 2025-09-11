#!/usr/bin/env bash
set -euo pipefail

# CONFIG
WEBHOOK_URL="https://rbwabemtucdkytvvpzvk.functions.supabase.co/mailerWebhook"
EMAIL="test@example.com"
GROUP="premium_monthly"
TIMESTAMP=$(date +%s)

# Read secrets from environment variables
export ANON_KEY="${ANON_KEY:?Missing ANON_KEY environment variable}"
export MAILERLITE_SIGNING_SECRET="${MAILERLITE_SIGNING_SECRET:?Missing MAILERLITE_SIGNING_SECRET environment variable}"
SECRET="$MAILERLITE_SIGNING_SECRET"

# Function to sign payloads
sign_payload() {
  local body="$1"
  echo -n "${TIMESTAMP}.${body}" | openssl dgst -sha256 -hmac "$SECRET" -binary | xxd -p -c 256
}

# Build payload
BODY=$(jq -nc --arg email "$EMAIL" --arg group "$GROUP" '{type:"subscriber.added_to_group", data:{email:$email, group:{name:$group}}}')

# Generate signature
SIGNATURE=$(sign_payload "$BODY")

echo "=== Running MailerLite Webhook Tests ==="

# Test 1: Valid request
echo "Test 1: Valid request"
curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "x-mailerlite-timestamp: $TIMESTAMP" \
  -H "x-mailerlite-signature: $SIGNATURE" \
  -d "$BODY" | jq

# Test 2: Invalid signature
echo "Test 2: Invalid signature"
curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "x-mailerlite-timestamp: $TIMESTAMP" \
  -H "x-mailerlite-signature: invalidsignature" \
  -d "$BODY" | jq

# Test 3: Expired timestamp
echo "Test 3: Expired timestamp"
OLD_TIMESTAMP=$((TIMESTAMP - 600)) # 10 min ago
OLD_SIGNATURE=$(echo -n "${OLD_TIMESTAMP}.${BODY}" | openssl dgst -sha256 -hmac "$SECRET" -binary | xxd -p -c 256)

curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "x-mailerlite-timestamp: $OLD_TIMESTAMP" \
  -H "x-mailerlite-signature: $OLD_SIGNATURE" \
  -d "$BODY" | jq

echo "=== Tests Completed ==="

# -------------------------------------------------------------------
# DB Verification (using psql, requires SUPABASE_DB_URL in secrets)
# -------------------------------------------------------------------
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "⚠️ Skipping DB checks — SUPABASE_DB_URL not set."
  exit 0
fi

echo "=== Checking subscriptions table ==="
psql "$SUPABASE_DB_URL" -c "SELECT user_email, tier, status, updated_at FROM subscriptions ORDER BY updated_at DESC LIMIT 5;"

echo "=== Checking webhook_logs table ==="
psql "$SUPABASE_DB_URL" -c "SELECT event_type, status, received_at FROM webhook_logs ORDER BY received_at DESC LIMIT 10;"
