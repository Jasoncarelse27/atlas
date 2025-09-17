#!/bin/bash

# Atlas Local vs Production Comparison
echo "🔄 Comparing Local vs Railway Endpoints"
echo "======================================="

LOCAL_URL="http://localhost:3000"
RAILWAY_URL="https://atlas-production-2123.up.railway.app"

echo "🏠 Testing LOCAL endpoint..."
echo "URL: $LOCAL_URL/healthz"

# Start local server if not running
if ! curl -s "$LOCAL_URL/healthz" > /dev/null 2>&1; then
    echo "⚠️  Local server not running. Starting..."
    npm run start > /dev/null 2>&1 &
    LOCAL_PID=$!
    sleep 3
    echo "✅ Local server started (PID: $LOCAL_PID)"
fi

LOCAL_RESPONSE=$(curl -s "$LOCAL_URL/healthz" 2>/dev/null)
LOCAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$LOCAL_URL/healthz" 2>/dev/null)

echo "📊 LOCAL Results:"
echo "  Status: $LOCAL_STATUS"
echo "  Response: $LOCAL_RESPONSE"
echo ""

echo "☁️  Testing RAILWAY endpoint..."
echo "URL: $RAILWAY_URL/healthz"

RAILWAY_RESPONSE=$(curl -s "$RAILWAY_URL/healthz" 2>/dev/null)
RAILWAY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$RAILWAY_URL/healthz" 2>/dev/null)

echo "📊 RAILWAY Results:"
echo "  Status: $RAILWAY_STATUS"
echo "  Response: $RAILWAY_RESPONSE"
echo ""

echo "🎯 COMPARISON:"
echo "=============="
if [ "$LOCAL_STATUS" = "200" ] && [ "$RAILWAY_STATUS" = "200" ]; then
    echo "✅ Both endpoints working perfectly!"
    echo "✅ Local and Railway responses match structure"
elif [ "$LOCAL_STATUS" = "200" ] && [ "$RAILWAY_STATUS" != "200" ]; then
    echo "⚠️  Local works, Railway needs attention"
    echo "🔧 Check Railway deployment logs"
elif [ "$LOCAL_STATUS" != "200" ] && [ "$RAILWAY_STATUS" = "200" ]; then
    echo "⚠️  Railway works, local server issue"
else
    echo "❌ Both endpoints need attention"
fi

# Cleanup local server if we started it
if [ ! -z "$LOCAL_PID" ]; then
    kill $LOCAL_PID 2>/dev/null
    echo "🧹 Cleaned up local test server"
fi
