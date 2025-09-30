#!/usr/bin/env bash
set -euo pipefail

# MailerLite Webhook Test Script
# This script tests the MailerLite webhook function with proper signature verification

MAILERLITE_SECRET="${MAILERLITE_SECRET:-your_mailerlite_secret}"
SUPABASE_FUNCTION_URL="${SUPABASE_FUNCTION_URL:-$SUPABASE_URL/functions/v1}"
WEBHOOK_URL="${SUPABASE_FUNCTION_URL}/mailerWebhook"

echo "🧪 Testing MailerLite Webhook Function"
echo "======================================"

# Test 1: Valid signature with subscriber.created
echo "📝 Test 1: Valid signature - subscriber.created"
BODY='{"type":"subscriber.created","data":{"email":"test@demo.com","fields":{"plan":"core"}}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$MAILERLITE_SECRET" -binary | base64)

echo "Body: $BODY"
echo "Signature: $SIGNATURE"
echo "Response:"
curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-mailerlite-signature: $SIGNATURE" \
  -d "$BODY" | jq .
echo ""

# Test 2: Valid signature with subscriber.updated
echo "📝 Test 2: Valid signature - subscriber.updated"
BODY='{"type":"subscriber.updated","data":{"email":"test@demo.com","fields":{"plan":"premium"}}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$MAILERLITE_SECRET" -binary | base64)

echo "Body: $BODY"
echo "Signature: $SIGNATURE"
echo "Response:"
curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-mailerlite-signature: $SIGNATURE" \
  -d "$BODY" | jq .
echo ""

# Test 3: Valid signature with subscriber.deleted
echo "📝 Test 3: Valid signature - subscriber.deleted"
BODY='{"type":"subscriber.deleted","data":{"email":"test@demo.com"}}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$MAILERLITE_SECRET" -binary | base64)

echo "Body: $BODY"
echo "Signature: $SIGNATURE"
echo "Response:"
curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-mailerlite-signature: $SIGNATURE" \
  -d "$BODY" | jq .
echo ""

# Test 4: Invalid signature (should fail)
echo "🔒 Test 4: Invalid signature (should fail)"
BODY='{"type":"subscriber.created","data":{"email":"test@demo.com","fields":{"plan":"core"}}}'

echo "Body: $BODY"
echo "Signature: invalid-signature"
echo "Response:"
curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-mailerlite-signature: invalid-signature" \
  -d "$BODY"
echo ""

# Test 5: Missing signature (should fail)
echo "🔒 Test 5: Missing signature (should fail)"
BODY='{"type":"subscriber.created","data":{"email":"test@demo.com","fields":{"plan":"core"}}}'

echo "Body: $BODY"
echo "Signature: (missing)"
echo "Response:"
curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$BODY"
echo ""

echo "✅ All tests completed!"
echo "📊 Expected results:"
echo "   - Tests 1-3: Should return {\"received\":true}"
echo "   - Tests 4-5: Should return 401 Unauthorized"
