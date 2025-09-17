#!/bin/bash

# Atlas Railway Health Check Script
echo "🚀 Testing Atlas Railway Deployment"
echo "=================================="

# Replace with your actual Railway URL
RAILWAY_URL="https://atlas-production-2123.up.railway.app"

echo "📍 Testing Railway health endpoint..."
echo "URL: $RAILWAY_URL/healthz"
echo ""

# Test with detailed output
curl -v -s "$RAILWAY_URL/healthz" 2>&1 | head -20

echo ""
echo "📊 Health Check Summary:"
echo "========================"

# Test just the JSON response
RESPONSE=$(curl -s "$RAILWAY_URL/healthz" 2>/dev/null)
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$RAILWAY_URL/healthz" 2>/dev/null)

if [ "$STATUS_CODE" = "200" ]; then
    echo "✅ Status Code: $STATUS_CODE (SUCCESS)"
    echo "✅ Response: $RESPONSE"
    echo ""
    echo "🎉 Railway deployment is working perfectly!"
else
    echo "❌ Status Code: $STATUS_CODE (FAILED)"
    echo "❌ Response: $RESPONSE"
    echo ""
    echo "🔧 Check Railway dashboard for deployment logs"
fi

echo ""
echo "🔗 Railway Dashboard: https://railway.app/dashboard"
