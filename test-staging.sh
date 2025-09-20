#!/bin/bash

# Test Railway Staging Deployment
echo "🚀 Testing Atlas Staging Deployment"
echo "=================================="

STAGING_URL="https://atlas-staging.up.railway.app"

echo "📍 Testing staging URL: $STAGING_URL"
echo ""

# Test health endpoint
echo "🔍 Testing /healthz endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$STAGING_URL/healthz")
HTTP_STATUS=$(echo "$HEALTH_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Health check passed!"
    echo "📋 Response: $HEALTH_BODY"
else
    echo "❌ Health check failed!"
    echo "📋 Status: $HTTP_STATUS"
    echo "📋 Response: $HEALTH_BODY"
fi

echo ""

# Test ping endpoint
echo "🔍 Testing /ping endpoint..."
PING_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$STAGING_URL/ping")
PING_STATUS=$(echo "$PING_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
PING_BODY=$(echo "$PING_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$PING_STATUS" = "200" ]; then
    echo "✅ Ping endpoint passed!"
    echo "📋 Response: $PING_BODY"
else
    echo "❌ Ping endpoint failed!"
    echo "📋 Status: $PING_STATUS"
    echo "📋 Response: $PING_BODY"
fi

echo ""

# Test message endpoint (should return 401 without auth)
echo "🔍 Testing /message endpoint (expecting 401)..."
MESSAGE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$STAGING_URL/message" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}')
MESSAGE_STATUS=$(echo "$MESSAGE_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
MESSAGE_BODY=$(echo "$MESSAGE_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$MESSAGE_STATUS" = "401" ]; then
    echo "✅ Message endpoint correctly requires authentication!"
    echo "📋 Response: $MESSAGE_BODY"
else
    echo "⚠️  Unexpected message endpoint response!"
    echo "📋 Status: $MESSAGE_STATUS"
    echo "📋 Response: $MESSAGE_BODY"
fi

echo ""
echo "🎉 Staging test complete!"
echo ""
echo "📝 Next steps:"
echo "   1. If health check passed: Staging is ready!"
echo "   2. Test user creation: Check Railway logs for 'Test user setup complete'"
echo "   3. Frontend integration: Update VITE_API_URL to staging URL"
