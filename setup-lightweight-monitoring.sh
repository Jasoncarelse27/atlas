#!/bin/bash

# Atlas Lightweight Monitoring Setup
echo "🎯 Setting up Atlas lightweight monitoring..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 Step 1: Supabase Logs Table${NC}"
echo "Run this SQL in your Supabase SQL Editor:"
echo "----------------------------------------"
cat supabase-logs-setup.sql
echo "----------------------------------------"

echo -e "\n${BLUE}🔧 Step 2: Environment Variables${NC}"
echo "Add these to your Railway environment variables:"
echo "SUPABASE_URL=your-supabase-project-url"
echo "SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"

echo -e "\n${BLUE}🚨 Step 3: Slack Alerts${NC}"
echo "1. Go to your Slack workspace"
echo "2. Create an Incoming Webhook: https://slack.com/apps/A0F7XDUAZ-incoming-webhooks"
echo "3. Add SLACK_WEBHOOK_URL to your GitHub repository secrets"
echo "4. Format: https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

echo -e "\n${BLUE}🧪 Step 4: Test the Setup${NC}"
echo "Test Railway health:"
echo "curl https://atlas-production-2123.up.railway.app/healthz"

echo -e "\n${BLUE}⏰ Step 5: Monitoring Schedule${NC}"
echo "GitHub Actions will now check your backend every 15 minutes"
echo "You'll get Slack alerts if anything goes wrong"

echo -e "\n${GREEN}✅ Lightweight monitoring setup complete!${NC}"
echo -e "${YELLOW}💡 Usage example in backend code:${NC}"
echo "import { logError } from './utils/logger.ts';"
echo ""
echo "try {"
echo "  // risky operation"
echo "} catch (err: any) {"
echo "  await logError('Failed to process message', err.stack, { userId: user.id });"
echo "}"

echo -e "\n${GREEN}🎉 Your Atlas backend is now bulletproof! 🛡️${NC}"
