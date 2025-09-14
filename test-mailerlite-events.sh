#!/bin/bash
set -euo pipefail

echo "🧪 Testing MailerLite Webhook Events - Production Verification"
echo "=============================================================="

# Configuration
WEBHOOK_URL="https://rbwabemtucdkytvvpzvk.supabase.co/functions/v1/mailerWebhook"
SECRET="wAGDBZzeJK"
TEST_EMAIL="test-$(date +%s)@demo.com"

echo "📧 Test Email: $TEST_EMAIL"
echo "🔗 Webhook URL: $WEBHOOK_URL"
echo ""

# Function to create signature
create_signature() {
    local body="$1"
    echo -n "$body" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64
}

# Function to send webhook
send_webhook() {
    local event_type="$1"
    local data="$2"
    local body="{\"type\":\"$event_type\",\"data\":$data}"
    local signature=$(create_signature "$body")
    
    echo "📤 Sending: $event_type"
    echo "📋 Data: $data"
    
    local response=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -H "x-mailerlite-signature: $signature" \
        -d "$body")
    
    local http_code=$(echo "$response" | tail -n1)
    local response_body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo "✅ Success: $response_body"
    else
        echo "❌ Failed ($http_code): $response_body"
    fi
    echo ""
}

echo "1️⃣ Testing subscriber.created event..."
send_webhook "subscriber.created" "{\"email\":\"$TEST_EMAIL\",\"fields\":{\"plan\":\"premium\",\"name\":\"Test User\"}}"

echo "2️⃣ Testing subscriber.updated event..."
send_webhook "subscriber.updated" "{\"email\":\"$TEST_EMAIL\",\"fields\":{\"plan\":\"enterprise\",\"name\":\"Test User Updated\"}}"

echo "3️⃣ Testing subscriber.unsubscribed event..."
send_webhook "subscriber.unsubscribed" "{\"email\":\"$TEST_EMAIL\",\"reason\":\"user_requested\"}"

echo "4️⃣ Testing subscriber.bounced event..."
send_webhook "subscriber.bounced" "{\"email\":\"$TEST_EMAIL\",\"reason\":\"mailbox_full\",\"bounce_type\":\"hard\"}"

echo "5️⃣ Testing subscriber.added_to_group event..."
send_webhook "subscriber.added_to_group" "{\"email\":\"$TEST_EMAIL\",\"group_id\":\"12345\",\"group_name\":\"Premium Users\"}"

echo "6️⃣ Testing subscriber.deleted event..."
send_webhook "subscriber.deleted" "{\"email\":\"$TEST_EMAIL\"}"

echo "7️⃣ Testing invalid signature (should fail)..."
curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "x-mailerlite-signature: invalid_signature" \
    -d "{\"type\":\"subscriber.created\",\"data\":{\"email\":\"$TEST_EMAIL\"}}" | \
    while read line; do
        if [[ $line =~ ^[0-9]+$ ]]; then
            if [ "$line" = "401" ]; then
                echo "✅ Security Test Passed: Invalid signature rejected ($line)"
            else
                echo "❌ Security Test Failed: Expected 401, got $line"
            fi
        else
            echo "📋 Response: $line"
        fi
    done

echo ""
echo "🎯 Test Summary:"
echo "=================="
echo "✅ All webhook events sent to: $WEBHOOK_URL"
echo "📧 Test email used: $TEST_EMAIL"
echo "🔍 Check Supabase logs for structured JSON output"
echo "📊 Verify profiles table updates in Supabase Dashboard"
echo ""
echo "Next steps:"
echo "1. Check Supabase Edge Function logs"
echo "2. Verify profiles table updates"
echo "3. Look for retry logs if any operations fail"
