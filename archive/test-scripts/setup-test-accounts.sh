#!/bin/bash

# Atlas Test Accounts Setup Script
echo "🧪 Setting up Atlas test accounts for tier gating validation..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📋 Choose your test account setup method:${NC}"
echo "1. Use fake email addresses (free_tester@atlas.app, etc.)"
echo "2. Use your own email with different tiers"
echo "3. Use temporary email services"

echo ""
echo -e "${GREEN}✅ Recommended: Option 1 (fake emails)${NC}"
echo "   - No real email addresses needed"
echo "   - Perfect for testing tier gating"
echo "   - Easy to clean up later"

echo ""
echo -e "${YELLOW}📝 To create test accounts:${NC}"
echo "1. Go to Supabase Dashboard → SQL Editor"
echo "2. Run the SQL from create-test-accounts.sql"
echo "3. Verify accounts were created"
echo "4. Use the accounts to test tier gating"

echo ""
echo -e "${GREEN}🎯 Test Account Details:${NC}"
echo "Free Tier: free_tester@atlas.app"
echo "Core Tier: core_tester@atlas.app" 
echo "Studio Tier: studio_tester@atlas.app"

echo ""
echo -e "${YELLOW}🔍 To verify accounts:${NC}"
echo "Run this SQL in Supabase:"
echo "SELECT id, email, subscription_tier FROM profiles WHERE email LIKE '%tester%';"
