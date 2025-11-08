#!/bin/bash
# 🔍 Verify All Environment Variables Match

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 COMPREHENSIVE ENV VAR VERIFICATION"
echo "========================================"
echo ""

# Check local .env
if [ -f .env ]; then
    echo "📋 Step 1: Local .env File"
    echo "---------------------------"
    
    VITE_KEY=$(grep "^VITE_SUPABASE_ANON_KEY=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'")
    BACKEND_KEY=$(grep "^SUPABASE_ANON_KEY=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'")
    
    if [ -z "$VITE_KEY" ]; then
        echo -e "${RED}❌ VITE_SUPABASE_ANON_KEY not found${NC}"
    else
        echo -e "${GREEN}✅ VITE_SUPABASE_ANON_KEY: Found (${#VITE_KEY} chars)${NC}"
        echo "   Starts with: ${VITE_KEY:0:30}..."
    fi
    
    if [ -z "$BACKEND_KEY" ]; then
        echo -e "${RED}❌ SUPABASE_ANON_KEY not found${NC}"
    else
        echo -e "${GREEN}✅ SUPABASE_ANON_KEY: Found (${#BACKEND_KEY} chars)${NC}"
        echo "   Starts with: ${BACKEND_KEY:0:30}..."
    fi
    
    if [ "$VITE_KEY" = "$BACKEND_KEY" ] && [ -n "$VITE_KEY" ]; then
        echo -e "${GREEN}✅ Local keys match${NC}"
        LOCAL_KEY="$VITE_KEY"
    else
        echo -e "${RED}❌ Local keys don't match${NC}"
        LOCAL_KEY=""
    fi
else
    echo -e "${RED}❌ .env file not found${NC}"
    LOCAL_KEY=""
fi

echo ""
echo "📋 Step 2: Manual Verification Required"
echo "----------------------------------------"
echo ""
echo "You need to manually verify these match:"
echo ""
echo "1. Supabase Dashboard:"
echo "   → https://supabase.com/dashboard"
echo "   → Your Project → Settings → API"
echo "   → Copy 'anon public' key"
echo "   → Should start with: ${LOCAL_KEY:0:30}..."
echo ""
echo "2. Railway Dashboard:"
echo "   → https://railway.app"
echo "   → Your Project → Settings → Variables"
echo "   → Find SUPABASE_ANON_KEY"
echo "   → Click to view/unmask"
echo "   → Should match Supabase 'anon public' exactly"
echo ""
echo "3. Vercel Dashboard:"
echo "   → https://vercel.com/dashboard"
echo "   → Your Project → Settings → Environment Variables"
echo "   → Find VITE_SUPABASE_ANON_KEY"
echo "   → Should match Railway SUPABASE_ANON_KEY exactly"
echo ""

if [ -n "$LOCAL_KEY" ]; then
    echo "📋 Step 3: Quick Comparison"
    echo "---------------------------"
    echo "Your local key starts with: ${LOCAL_KEY:0:50}..."
    echo ""
    echo "Compare this with:"
    echo "  - Supabase Dashboard 'anon public'"
    echo "  - Railway SUPABASE_ANON_KEY"
    echo "  - Vercel VITE_SUPABASE_ANON_KEY"
    echo ""
    echo "All should start with the same characters!"
fi

echo ""
echo "✅ Verification script complete!"
echo ""
echo "If values don't match:"
echo "  1. Copy Supabase 'anon public' key (source of truth)"
echo "  2. Update Railway SUPABASE_ANON_KEY"
echo "  3. Update Vercel VITE_SUPABASE_ANON_KEY"
echo "  4. Wait for auto-redeploy (~2 min)"
echo "  5. Test again"

