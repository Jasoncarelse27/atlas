#!/bin/bash
# 🔍 Ultra-Pro Diagnostic: 401 Auth Failure Root Cause Analysis
# One-shot, production-safe diagnostic script

set -e

echo "🔍 ATLAS 401 AUTH DIAGNOSTIC"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check Railway environment variables
echo "📋 Step 1: Checking Railway Environment Variables"
echo "---------------------------------------------------"

if command -v railway &> /dev/null; then
    echo "✅ Railway CLI found"
    
    echo ""
    echo "Backend SUPABASE_ANON_KEY (first 20 chars):"
    RAILWAY_ANON=$(railway variables get SUPABASE_ANON_KEY 2>/dev/null || echo "NOT SET")
    if [ "$RAILWAY_ANON" != "NOT SET" ]; then
        echo -e "${GREEN}✅ Found: ${RAILWAY_ANON:0:20}...${NC}"
    else
        echo -e "${RED}❌ SUPABASE_ANON_KEY not set in Railway${NC}"
    fi
    
    echo ""
    echo "Backend SUPABASE_URL:"
    RAILWAY_URL=$(railway variables get SUPABASE_URL 2>/dev/null || echo "NOT SET")
    if [ "$RAILWAY_URL" != "NOT SET" ]; then
        echo -e "${GREEN}✅ Found: $RAILWAY_URL${NC}"
    else
        echo -e "${RED}❌ SUPABASE_URL not set in Railway${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Railway CLI not installed. Install with: npm i -g @railway/cli${NC}"
    echo "   Or check Railway Dashboard → Variables manually"
fi

echo ""
echo "📋 Step 2: Checking Local Environment Variables"
echo "---------------------------------------------------"

if [ -f .env ]; then
    echo "✅ .env file found"
    
    # Extract from .env (if exists)
    if grep -q "SUPABASE_ANON_KEY" .env 2>/dev/null; then
        LOCAL_ANON=$(grep "SUPABASE_ANON_KEY" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
        echo -e "${GREEN}✅ Local ANON_KEY: ${LOCAL_ANON:0:20}...${NC}"
    else
        echo -e "${YELLOW}⚠️  SUPABASE_ANON_KEY not found in .env${NC}"
    fi
    
    if grep -q "VITE_SUPABASE_ANON_KEY" .env 2>/dev/null; then
        VITE_ANON=$(grep "VITE_SUPABASE_ANON_KEY" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
        echo -e "${GREEN}✅ Local VITE_ANON_KEY: ${VITE_ANON:0:20}...${NC}"
    else
        echo -e "${YELLOW}⚠️  VITE_SUPABASE_ANON_KEY not found in .env${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No .env file found${NC}"
fi

echo ""
echo "📋 Step 3: Verification Logic"
echo "---------------------------------------------------"
echo ""
echo "✅ Backend uses: supabasePublic.auth.getUser(token)"
echo "   → Uses SUPABASE_ANON_KEY for JWT verification"
echo ""
echo "✅ Frontend uses: VITE_SUPABASE_ANON_KEY"
echo "   → Must match backend's SUPABASE_ANON_KEY"
echo ""
echo -e "${YELLOW}⚠️  CRITICAL: These keys MUST match byte-for-byte${NC}"
echo ""

echo "📋 Step 4: Quick Fix Commands"
echo "---------------------------------------------------"
echo ""
echo "If keys don't match, run these commands:"
echo ""
echo "1. Get your Supabase ANON_KEY from dashboard:"
echo "   → Supabase Dashboard → Settings → API → anon public"
echo ""
echo "2. Set in Railway:"
echo "   railway variables set SUPABASE_ANON_KEY=<your-anon-key>"
echo ""
echo "3. Redeploy:"
echo "   railway redeploy"
echo ""
echo "4. Verify frontend matches:"
echo "   → Vercel Dashboard → Settings → Environment Variables"
echo "   → Ensure VITE_SUPABASE_ANON_KEY matches Railway's SUPABASE_ANON_KEY"
echo ""

echo "✅ Diagnostic complete!"
echo ""
echo "Next steps:"
echo "1. Compare Railway SUPABASE_ANON_KEY with Supabase Dashboard"
echo "2. Compare Vercel VITE_SUPABASE_ANON_KEY with Railway SUPABASE_ANON_KEY"
echo "3. If mismatch found → sync keys → redeploy → test"

