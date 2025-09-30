#!/usr/bin/env bash
set -euo pipefail

# 🌐 Base URL for Railway deployment
BASE_URL="https://atlas-staging.up.railway.app"

echo "🚀 Starting Atlas sanity tests against $BASE_URL"
echo "---------------------------------------------"

# 1️⃣ Healthcheck
echo "✅ Checking /healthz ..."
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/healthz")
echo "   Response: $HEALTH_CODE (expect 200)"

# 2️⃣ Auth test (should return 401 without token)
echo "✅ Checking /message endpoint without token (expect 401)..."
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/message" \
  -H "Content-Type: application/json" \
  -d '{"tier":"free","message":"Hello"}')
echo "   Response: $AUTH_CODE (expect 401)"

# 3️⃣ Paddle environment test
echo "✅ Checking Paddle environment..."
PADDLE_CODE=$(curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/admin/paddle-test")
echo "   Response: $PADDLE_CODE (expect 200 if Paddle env vars set, 500 if missing)"

if [ "$PADDLE_CODE" = "200" ]; then
  echo "   🎉 Paddle environment is configured!"
  curl -s "$BASE_URL/admin/paddle-test" | jq .message
else
  echo "   ⚠️  Paddle environment variables missing"
fi

# 4️⃣ Admin endpoint protection
echo "✅ Checking admin endpoint protection..."
ADMIN_CODE=$(curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/admin/verify-subscription")
echo "   Response: $ADMIN_CODE (expect 401 without token)"

echo "---------------------------------------------"
echo "🎯 Sanity Test Summary:"
echo "   Health Check: $HEALTH_CODE (expect 200)"
echo "   Auth Protection: $AUTH_CODE (expect 401)" 
echo "   Paddle Config: $PADDLE_CODE (expect 200 or 500)"
echo "   Admin Protection: $ADMIN_CODE (expect 401)"
echo ""

if [ "$HEALTH_CODE" = "200" ] && [ "$AUTH_CODE" = "401" ] && [ "$ADMIN_CODE" = "401" ]; then
  echo "🎉 BASIC DEPLOYMENT SUCCESSFUL!"
  echo "   ✅ Server is running and healthy"
  echo "   ✅ Authentication is working"
  echo "   ✅ Endpoints are properly protected"
  echo ""
  
  if [ "$PADDLE_CODE" = "200" ]; then
    echo "🎉 PADDLE INTEGRATION READY!"
    echo "   ✅ Environment variables configured"
    echo "   ✅ Ready for checkout testing"
  else
    echo "⚠️  PADDLE SETUP NEEDED:"
    echo "   - Add Paddle environment variables to Railway"
    echo "   - Test again after env vars are set"
  fi
else
  echo "❌ DEPLOYMENT ISSUES DETECTED:"
  echo "   - Check Railway logs for errors"
  echo "   - Verify environment variables are set"
  echo "   - Ensure all middleware is working"
fi

echo ""
echo "💡 Next Steps:"
echo "   1. If Paddle shows 500: Add Paddle env vars to Railway"
echo "   2. Test frontend at your Railway domain"
echo "   3. Test complete upgrade flow with Paddle sandbox"
echo "   4. Switch to live Paddle for production"
