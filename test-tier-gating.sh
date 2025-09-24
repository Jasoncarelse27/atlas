#!/bin/bash

# Atlas Tier Gating Quick Test Script
# Run this to quickly validate tier gating is working

echo "🧪 Atlas Tier Gating Quick Test"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo "🔍 Checking backend status..."
if curl -s http://localhost:3000/ping > /dev/null; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${RED}❌ Backend is not running. Start with: node backend/server.mjs${NC}"
    exit 1
fi

# Check admin API
echo "🔍 Testing admin API..."
ADMIN_RESPONSE=$(curl -s "http://localhost:3000/admin/metrics" 2>/dev/null)
if [ $? -eq 0 ] && echo "$ADMIN_RESPONSE" | grep -q "feature_attempts"; then
    echo -e "${GREEN}✅ Admin API is working${NC}"
else
    echo -e "${YELLOW}⚠️  Admin API may not be fully configured${NC}"
fi

# Check if we can create test users
echo "🔍 Checking Supabase connection..."
if curl -s "http://localhost:3000/v1/user_profiles" > /dev/null; then
    echo -e "${GREEN}✅ Supabase connection is working${NC}"
else
    echo -e "${RED}❌ Supabase connection failed${NC}"
fi

echo ""
echo "📋 Manual Testing Required:"
echo "1. Open http://localhost:5173 in browser"
echo "2. Login with test account"
echo "3. Try each feature (text, audio, image, camera)"
echo "4. Verify upgrade modals appear for blocked features"
echo "5. Check browser console for any 'DEV MODE' bypass messages"

echo ""
echo "🎯 Expected Behavior:"
echo "- Free tier: Only text works, others show upgrade modal"
echo "- Core tier: Text + audio + image work, camera blocked"
echo "- Studio tier: All features work"

echo ""
echo "📖 Full test script: ATLAS_QA_TIER_GATING_TEST_SCRIPT.md"
