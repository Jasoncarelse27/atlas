#!/bin/bash

# Setup script for auto-sync functionality
# This sets up the cron job and initial configuration

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REPO_DIR="/Users/jasoncarelse/atlas"
SCRIPT_PATH="$REPO_DIR/scripts/auto-sync-github.sh"

echo -e "${BLUE}🔧 Setting up auto-sync for Atlas AI...${NC}"

# Check if script exists
if [ ! -f "$SCRIPT_PATH" ]; then
    echo -e "${RED}❌ Auto-sync script not found at $SCRIPT_PATH${NC}"
    exit 1
fi

# Make script executable
chmod +x "$SCRIPT_PATH"
echo -e "${GREEN}✅ Made auto-sync script executable${NC}"

# Create logs directory
mkdir -p "$REPO_DIR/logs"
echo -e "${GREEN}✅ Created logs directory${NC}"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "auto-sync-github.sh"; then
    echo -e "${YELLOW}⚠️ Auto-sync cron job already exists${NC}"
    echo "Current cron jobs:"
    crontab -l | grep "auto-sync-github.sh"
else
    # Add cron job to run every hour
    (crontab -l 2>/dev/null; echo "0 * * * * $SCRIPT_PATH") | crontab -
    echo -e "${GREEN}✅ Added auto-sync cron job (runs every hour)${NC}"
fi

# Test the script
echo -e "${BLUE}🧪 Testing auto-sync script...${NC}"
if "$SCRIPT_PATH"; then
    echo -e "${GREEN}✅ Auto-sync script test successful${NC}"
else
    echo -e "${YELLOW}⚠️ Auto-sync script test had issues (this is normal if working tree is dirty)${NC}"
fi

echo -e "${GREEN}🎉 Auto-sync setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 What was set up:${NC}"
echo "  • Cron job runs every hour"
echo "  • Only syncs when working tree is clean"
echo "  • Skips feature branches (only syncs main/develop)"
echo "  • Logs all activity to $REPO_DIR/logs/auto-sync.log"
echo "  • Prevents concurrent syncs with lock files"
echo ""
echo -e "${BLUE}🔍 To monitor:${NC}"
echo "  • View logs: tail -f $REPO_DIR/logs/auto-sync.log"
echo "  • Check cron jobs: crontab -l"
echo "  • Manual sync: $SCRIPT_PATH"
