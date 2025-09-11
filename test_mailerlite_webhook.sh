#!/usr/bin/env bash
set -euo pipefail

# ----------------------------
# CONFIG
# ----------------------------
SUPABASE_URL="https://rbwabemtucdkytvvpzvk.supabase.co"
FUNCTION_URL="$SUPABASE_URL/functions/v1/mailerWebhook"
SUPABASE_DB_URL="postgresql://postgres:[YOUR_DB_PASSWORD]@db.rbwabemtucdkytvvpzvk.supabase.co:5432/postgres"
MAILERLITE_SIGNING_SECRET=${MAILERLITE_SIGNING_SECRET:-"your-actual-secret"} # export this before running

TEST_EMAIL="test@example.com"
GROUP_NAME="premium_monthly"

EVENTS=("subscriber.added_to_group" "subscriber.removed_from_group" "subscriber.updated" "subscriber.deleted")

# ----------------------------
# FUNCTION: Send Event
# ----------------------------
send_event() {
  local EVENT_TYPE=$1
  local TIMESTAMP=$(date +%s)

  # Build payload
  local PAYLOAD=$(jq -n \
    --arg email "$TEST_EMAIL" \
    --arg group "$GROUP_NAME" \
    --arg type "$EVENT_TYPE" \
    --arg ts "$TIMESTAMP" \
    '{ type: $type, data: { email: $email, group: { name: $group } }, timestamp: $ts }')

  # Generate signature
  local SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$MAILERLITE_SIGNING_SECRET" | cut -d " " -f2)

  # Send request
  echo "🚀 Sending $EVENT_TYPE..."
  curl -s -X POST "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -H "x-mailerlite-signature: $SIGNATURE" \
    -H "x-mailerlite-timestamp: $TIMESTAMP" \
    -d "$PAYLOAD" | jq .

  echo "✅ Sent $EVENT_TYPE"
  echo
}

# ----------------------------
# MAIN LOOP
# ----------------------------
for EVENT in "${EVENTS[@]}"; do
  send_event "$EVENT"
  sleep 2
done

# ----------------------------
# 4. Verify in Supabase database
# ----------------------------
echo "🔍 Checking subscriptions table..."
psql "$SUPABASE_DB_URL" -c "SELECT * FROM subscriptions WHERE user_email = '$TEST_EMAIL' ORDER BY updated_at DESC LIMIT 1;"

echo "🔍 Checking webhook_logs table..."
psql "$SUPABASE_DB_URL" -c "SELECT event_type, status, received_at FROM webhook_logs ORDER BY received_at DESC LIMIT 10;"
