#!/bin/bash

# Setup script for rebase watchdog
# This sets up the watchdog to run in the background

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

REPO_DIR="/Users/jasoncarelse/atlas"
WATCHDOG_SCRIPT="$REPO_DIR/scripts/watchdog-rebase.sh"
PID_FILE="$REPO_DIR/.watchdog.pid"

echo -e "${BLUE}🐕 Setting up rebase watchdog for Atlas AI...${NC}"

# Check if watchdog script exists
if [ ! -f "$WATCHDOG_SCRIPT" ]; then
    echo -e "${RED}❌ Watchdog script not found at $WATCHDOG_SCRIPT${NC}"
    exit 1
fi

# Make script executable
chmod +x "$WATCHDOG_SCRIPT"
echo -e "${GREEN}✅ Made watchdog script executable${NC}"

# Create logs directory
mkdir -p "$REPO_DIR/logs"
echo -e "${GREEN}✅ Created logs directory${NC}"

# Check if watchdog is already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️ Watchdog is already running (PID: $PID)${NC}"
        echo "To stop it: kill $PID"
        echo "To restart: $0 restart"
        exit 0
    else
        echo -e "${YELLOW}⚠️ Stale PID file found, removing...${NC}"
        rm -f "$PID_FILE"
    fi
fi

# Start watchdog in background
echo -e "${BLUE}🚀 Starting watchdog in background...${NC}"
nohup "$WATCHDOG_SCRIPT" > /dev/null 2>&1 &
WATCHDOG_PID=$!

# Save PID
echo "$WATCHDOG_PID" > "$PID_FILE"
echo -e "${GREEN}✅ Watchdog started (PID: $WATCHDOG_PID)${NC}"

# Wait a moment and check if it's still running
sleep 2
if ps -p "$WATCHDOG_PID" > /dev/null 2>&1; then
    echo -e "${GREEN}🎉 Watchdog setup complete!${NC}"
    echo ""
    echo -e "${BLUE}📋 What was set up:${NC}"
    echo "  • Watchdog runs in background (PID: $WATCHDOG_PID)"
    echo "  • Monitors for rebase operations every 30 seconds"
    echo "  • Shows system notifications for alerts"
    echo "  • Logs all activity to $REPO_DIR/logs/watchdog-rebase.log"
    echo "  • Prevents data loss during rebase operations"
    echo ""
    echo -e "${BLUE}🔍 To monitor:${NC}"
    echo "  • View logs: tail -f $REPO_DIR/logs/watchdog-rebase.log"
    echo "  • Check status: ps -p $WATCHDOG_PID"
    echo "  • Stop watchdog: kill $WATCHDOG_PID"
    echo "  • Restart: $0 restart"
else
    echo -e "${RED}❌ Failed to start watchdog${NC}"
    rm -f "$PID_FILE"
    exit 1
fi
