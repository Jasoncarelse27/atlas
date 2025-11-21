#!/bin/bash

# Test FastSpring and MailerLite Webhook Endpoints
# Usage: ./scripts/test-webhooks.sh

set -e

RAILWAY_URL="${RAILWAY_URL:-https://atlas-production-2123.up.railway.app}"

echo "🧪 Testing Webhook Endpoints"
echo "================================"
echo ""

# Test FastSpring webhook
echo "1️⃣ Testing FastSpring Webhook: ${RAILWAY_URL}/api/fastspring/webhook"
echo ""

FASTSPRING_TEST_PAYLOAD='{
  "events": [{
    "id": "test-event-123",
    "type": "subscription.activated",
    "data": {
      "subscription": "test-sub-123",
      "account": "test-account-456",
      "state": "active",
      "product": {
        "path": "atlas-core-monthly"
      },
      "tags": {
        "user_id": "test-user-id"
      }
    }
  }]
}'

curl -X POST "${RAILWAY_URL}/api/fastspring/webhook" \
  -H "Content-Type: application/json" \
  -H "FastSpring-Hmac-Sha256: test-signature" \
  -d "${FASTSPRING_TEST_PAYLOAD}" \
  -w "\nHTTP Status: %{http_code}\n" \
  -v || echo "❌ FastSpring webhook test failed"

echo ""
echo ""

# Test MailerLite webhook
echo "2️⃣ Testing MailerLite Webhook: ${RAILWAY_URL}/api/mailerlite/webhook"
echo ""

MAILERLITE_TEST_PAYLOAD='{
  "event": "subscriber.created",
  "data": {
    "email": "test@example.com"
  }
}'

curl -X POST "${RAILWAY_URL}/api/mailerlite/webhook" \
  -H "Content-Type: application/json" \
  -H "X-MailerLite-Signature: test-signature" \
  -d "${MAILERLITE_TEST_PAYLOAD}" \
  -w "\nHTTP Status: %{http_code}\n" \
  -v || echo "❌ MailerLite webhook test failed"

echo ""
echo "✅ Webhook tests completed"
echo ""
echo "Note: These tests will fail signature verification (expected)"
echo "To test properly, use FastSpring/MailerLite dashboard test tools"

