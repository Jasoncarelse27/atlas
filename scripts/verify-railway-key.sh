#!/bin/bash
# 🔍 DEFINITIVE Railway SUPABASE_ANON_KEY Verification Script

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 RAILWAY SUPABASE_ANON_KEY VERIFICATION"
echo "=========================================="
echo ""

# Get local key
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

LOCAL_KEY=$(grep "^SUPABASE_ANON_KEY=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'")

if [ -z "$LOCAL_KEY" ]; then
    echo -e "${RED}❌ SUPABASE_ANON_KEY not found in .env${NC}"
    exit 1
fi

echo "📋 Step 1: Local .env Key"
echo "-------------------------"
echo "  Length: ${#LOCAL_KEY} chars"
echo "  Starts: ${LOCAL_KEY:0:50}..."
echo "  Ends:   ...${LOCAL_KEY: -50}"
echo ""

# Test Railway endpoint
echo "📋 Step 2: Testing Railway Backend"
echo "-----------------------------------"
RAILWAY_STATUS=$(curl -s "https://atlas-production-2123.up.railway.app/api/auth/status" 2>/dev/null || echo "ERROR")

if [ "$RAILWAY_STATUS" = "ERROR" ]; then
    echo -e "${RED}❌ Could not reach Railway backend${NC}"
    exit 1
fi

RAILWAY_ANON_LENGTH=$(echo "$RAILWAY_STATUS" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('supabaseConfig', {}).get('anonKeyLength', 0))" 2>/dev/null || echo "0")
RAILWAY_PREVIEW=$(echo "$RAILWAY_STATUS" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('supabaseConfig', {}).get('anonKeyPreview', 'N/A'))" 2>/dev/null || echo "N/A")

echo "  Railway anon key length: $RAILWAY_ANON_LENGTH chars"
echo "  Railway key preview: $RAILWAY_PREVIEW"
echo ""

# Compare
LOCAL_PREVIEW="${LOCAL_KEY:0:10}...${LOCAL_KEY: -10}"

echo "📋 Step 3: Comparison"
echo "---------------------"
echo "  Local preview:  $LOCAL_PREVIEW"
echo "  Railway preview: $RAILWAY_PREVIEW"
echo ""

if [ "${#LOCAL_KEY}" -eq "$RAILWAY_ANON_LENGTH" ] && [ "$RAILWAY_ANON_LENGTH" -eq 208 ]; then
    echo -e "${GREEN}✅ Lengths match (208 chars)${NC}"
else
    echo -e "${RED}❌ Length mismatch!${NC}"
    echo "   Local: ${#LOCAL_KEY} chars"
    echo "   Railway: $RAILWAY_ANON_LENGTH chars"
    echo "   Expected: 208 chars"
fi

if [ "$LOCAL_PREVIEW" = "$RAILWAY_PREVIEW" ]; then
    echo -e "${GREEN}✅ Key previews match${NC}"
else
    echo -e "${RED}❌ Key previews DON'T match${NC}"
    echo ""
    echo "🔧 FIX REQUIRED:"
    echo "   1. Go to Supabase Dashboard → Settings → API"
    echo "   2. Copy the 'anon public' key (should start with: ${LOCAL_KEY:0:20}...)"
    echo "   3. Go to Railway → Variables → SUPABASE_ANON_KEY"
    echo "   4. DELETE old value completely"
    echo "   5. Paste FULL key from Supabase"
    echo "   6. Verify it ends with: ...${LOCAL_KEY: -20}"
    echo "   7. Save and wait 2 minutes for redeploy"
fi

echo ""
echo "📋 Step 4: Token Verification Test"
echo "-----------------------------------"
echo "  After Railway redeploys, test with:"
echo "  curl -H 'Authorization: Bearer YOUR_TOKEN' https://atlas-production-2123.up.railway.app/api/auth/status"
echo ""

