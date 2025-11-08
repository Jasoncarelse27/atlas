#!/bin/bash
# 🔍 Verify 401 Auth Fix - Test Backend Token Verification

set -e

echo "🔍 VERIFYING 401 AUTH FIX"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKEND_URL="https://atlas-production-2123.up.railway.app"

echo "📋 Step 1: Testing Backend Health"
echo "-----------------------------------"
HEALTH=$(curl -s "${BACKEND_URL}/healthz" 2>/dev/null || echo "FAILED")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    exit 1
fi

echo ""
echo "📋 Step 2: Testing 401 Without Token"
echo "--------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" "${BACKEND_URL}/api/message" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"message":"test"}' 2>/dev/null || echo "FAILED\n000")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Backend correctly returns 401 without token${NC}"
    echo "   Response: $BODY" | head -c 100
    echo ""
else
    echo -e "${YELLOW}⚠️  Unexpected response code: $HTTP_CODE${NC}"
fi

echo ""
echo "📋 Step 3: Checking Railway Logs for Supabase Errors"
echo "------------------------------------------------------"
echo "Check Railway Dashboard → Logs for:"
echo "  - 'Supabase not configured - missing: SUPABASE_ANON_KEY'"
echo "  - '[verifyJWT] ❌ Token verification failed'"
echo "  - '✅ Supabase client initialized successfully'"
echo ""

echo "📋 Step 4: Manual Verification Steps"
echo "--------------------------------------"
echo "1. Railway Dashboard → Variables → Check SUPABASE_ANON_KEY exists"
echo "2. Supabase Dashboard → Settings → API → Copy 'anon public' key"
echo "3. Compare Railway SUPABASE_ANON_KEY with Supabase 'anon public'"
echo "4. They MUST match exactly (byte-for-byte)"
echo ""

echo "📋 Step 5: Test with Real Token"
echo "--------------------------------"
echo "To test with a real token:"
echo "1. Open browser console on Atlas app"
echo "2. Run: await supabase.auth.getSession()"
echo "3. Copy the access_token"
echo "4. Test: curl -H 'Authorization: Bearer <token>' ${BACKEND_URL}/api/message"
echo ""

echo "✅ Verification script complete!"
echo ""
echo "If Railway SUPABASE_ANON_KEY doesn't match Supabase Dashboard:"
echo "  1. Update Railway variable to match Supabase"
echo "  2. Railway will auto-redeploy"
echo "  3. Test again after deployment"

