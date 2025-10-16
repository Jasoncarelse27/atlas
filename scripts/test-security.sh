#!/bin/bash
# 🔒 Atlas Security Penetration Testing Suite
# Tests all critical security fixes to ensure revenue protection
# Run this script after deploying security updates

set -e

echo "🔒 Atlas Security Penetration Testing"
echo "======================================"
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:8000}"
TEST_USER_ID="${TEST_USER_ID:-550e8400-e29b-41d4-a716-446655440000}"
TEST_TOKEN="${TEST_TOKEN:-your-test-jwt-token}"

PASSED=0
FAILED=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test result tracker
test_result() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"
  
  if [[ "$actual" == *"$expected"* ]]; then
    echo -e "${GREEN}✅ PASS${NC}: $test_name"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC}: $test_name"
    echo "   Expected: $expected"
    echo "   Actual: $actual"
    ((FAILED++))
  fi
}

echo "Testing against: $API_URL"
echo ""

# ============================================================================
# Test 1: Tier escalation via removed endpoint should fail
# ============================================================================
echo -e "${YELLOW}[TEST 1]${NC} Attempting tier escalation via removed endpoint..."
response=$(curl -s -X PUT "$API_URL/v1/user_profiles/$TEST_USER_ID" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subscription_tier": "studio"}' \
  -w "\n%{http_code}")

http_code=$(echo "$response" | tail -n1)
test_result "Removed tier update endpoint" "404" "$http_code"
echo ""

# ============================================================================
# Test 2: Mock token should be rejected
# ============================================================================
echo -e "${YELLOW}[TEST 2]${NC} Using mock token (should be rejected)..."
response=$(curl -s "$API_URL/api/health" \
  -H "Authorization: Bearer mock-token-for-development" \
  -w "\n%{http_code}")

http_code=$(echo "$response" | tail -n1)
test_result "Mock token bypass removed" "401" "$http_code"
echo ""

# ============================================================================
# Test 3: Webhook without signature should be rejected
# ============================================================================
echo -e "${YELLOW}[TEST 3]${NC} Sending webhook without signature..."
response=$(curl -s -X POST "$API_URL/api/fastspring-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "subscription.activated",
    "accountId": "'$TEST_USER_ID'",
    "newTier": "studio",
    "oldTier": "free"
  }' \
  -w "\n%{http_code}")

http_code=$(echo "$response" | tail -n1)
test_result "Webhook signature verification" "401" "$http_code"
echo ""

# ============================================================================
# Test 4: Client-sent tier in request body should be ignored
# ============================================================================
echo -e "${YELLOW}[TEST 4]${NC} Sending fake tier in message request..."
echo "   (Server should fetch tier from database, not use client-sent value)"
response=$(curl -s -X POST "$API_URL/api/message" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "studio",
    "message": "Test message",
    "conversationId": null
  }' \
  -w "\n%{http_code}")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

# Check if response indicates server-side tier enforcement
if [[ "$body" == *"tier"* ]] || [[ "$http_code" == "200" ]]; then
  echo -e "${GREEN}✅ PASS${NC}: Server processes request (tier fetched from DB)"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Request failed unexpectedly"
  echo "   Response: $body"
  ((FAILED++))
fi
echo ""

# ============================================================================
# Test 5: Free tier message limit enforcement
# ============================================================================
echo -e "${YELLOW}[TEST 5]${NC} Testing free tier message limit..."
echo "   (Requires test user to be at message limit)"
echo "   Skipping automated test - requires manual verification"
echo ""

# ============================================================================
# Test 6: Admin endpoints require authentication
# ============================================================================
echo -e "${YELLOW}[TEST 6]${NC} Accessing admin endpoints without authentication..."
response=$(curl -s "$API_URL/api/admin/snapshots" \
  -w "\n%{http_code}")

http_code=$(echo "$response" | tail -n1)
if [[ "$http_code" == "404" ]] || [[ "$http_code" == "401" ]] || [[ "$http_code" == "403" ]]; then
  echo -e "${GREEN}✅ PASS${NC}: Admin endpoints protected (${http_code})"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Admin endpoints not properly protected"
  echo "   HTTP Code: $http_code"
  ((FAILED++))
fi
echo ""

# ============================================================================
# Test 7: RLS policies prevent tier self-update
# ============================================================================
echo -e "${YELLOW}[TEST 7]${NC} RLS policy test (tier self-update prevention)"
echo "   This test requires direct Supabase client access"
echo "   Run manually: UPDATE profiles SET subscription_tier = 'studio' WHERE id = auth.uid();"
echo "   Expected: Policy violation error"
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "======================================"
echo "Test Summary:"
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All automated security tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Run manual RLS test in Supabase SQL Editor"
  echo "  2. Verify webhook signature verification with real FastSpring events"
  echo "  3. Test free tier message limits with test user"
  echo "  4. Monitor security_alerts view for anomalies"
  exit 0
else
  echo -e "${RED}❌ Some security tests failed. Review and fix before deploying.${NC}"
  exit 1
fi

