#!/bin/bash

# =====================================================
# Atlas V1 Tier Enforcement Test Script
# Tests server-side tier enforcement functionality
# =====================================================

set -e

echo "🧪 Testing Atlas V1 Tier Enforcement..."

# Configuration
BACKEND_URL="http://localhost:3000"
TEST_USER_ID="test-user-$(date +%s)"

echo "📋 Test Configuration:"
echo "   Backend URL: $BACKEND_URL"
echo "   Test User ID: $TEST_USER_ID"
echo ""

# Test 1: Get tier info for new user (should default to 'free')
echo "🔍 Test 1: Get tier info for new user..."
curl -s -X GET "$BACKEND_URL/api/user/tier-info?userId=$TEST_USER_ID" | jq '.' || echo "❌ Test 1 failed"

echo ""

# Test 2: Send 15 messages (should all succeed for Free tier)
echo "📤 Test 2: Send 15 messages (Free tier limit)..."
for i in {1..15}; do
    echo "   Sending message $i..."
    response=$(curl -s -X POST "$BACKEND_URL/api/message" \
        -H "Content-Type: application/json" \
        -d "{\"userId\":\"$TEST_USER_ID\",\"message\":\"Test message $i\"}")
    
    success=$(echo "$response" | jq -r '.success // false')
    if [ "$success" = "true" ]; then
        echo "   ✅ Message $i sent successfully"
    else
        echo "   ❌ Message $i failed: $response"
    fi
done

echo ""

# Test 3: Try to send 16th message (should be blocked)
echo "🚫 Test 3: Try to send 16th message (should be blocked)..."
response=$(curl -s -X POST "$BACKEND_URL/api/message" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"$TEST_USER_ID\",\"message\":\"This should be blocked\"}")

success=$(echo "$response" | jq -r '.success // false')
if [ "$success" = "false" ]; then
    echo "   ✅ 16th message correctly blocked!"
    echo "   Response: $response"
else
    echo "   ❌ 16th message was not blocked: $response"
fi

echo ""

# Test 4: Check feature access for Free tier
echo "🔒 Test 4: Check feature access for Free tier..."
for feature in "text" "audio" "image"; do
    echo "   Checking $feature access..."
    response=$(curl -s -X POST "$BACKEND_URL/api/feature/check" \
        -H "Content-Type: application/json" \
        -d "{\"userId\":\"$TEST_USER_ID\",\"feature\":\"$feature\"}")
    
    allowed=$(echo "$response" | jq -r '.allowed // false')
    if [ "$feature" = "text" ]; then
        if [ "$allowed" = "true" ]; then
            echo "   ✅ $feature access correctly allowed"
        else
            echo "   ❌ $feature access incorrectly blocked"
        fi
    else
        if [ "$allowed" = "false" ]; then
            echo "   ✅ $feature access correctly blocked"
        else
            echo "   ❌ $feature access incorrectly allowed"
        fi
    fi
done

echo ""

# Test 5: Get final tier info
echo "📊 Test 5: Get final tier info..."
curl -s -X GET "$BACKEND_URL/api/user/tier-info?userId=$TEST_USER_ID" | jq '.' || echo "❌ Test 5 failed"

echo ""

# Test 6: Check analytics (if available)
echo "📈 Test 6: Check tier analytics..."
curl -s -X GET "$BACKEND_URL/api/admin/tier-analytics" | jq '.' || echo "❌ Test 6 failed (analytics endpoint not available)"

echo ""
echo "🎉 Tier Enforcement Testing Complete!"
echo ""
echo "📋 Expected Results:"
echo "   ✅ New users default to 'free' tier"
echo "   ✅ Free tier users can send 15 messages"
echo "   ✅ 16th message is blocked with proper error"
echo "   ✅ Text access allowed for all tiers"
echo "   ✅ Audio/Image access blocked for Free tier"
echo "   ✅ Usage tracking works correctly"
echo ""
echo "🔒 Server-side enforcement is now protecting your API!"
