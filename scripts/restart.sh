#!/bin/bash
# Atlas Unified Restart Script (Node 22 enforced + Status Check)

# Always use Node 22
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22 > /dev/null

# Colors
GREEN="\033[0;32m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo "🔄 Restarting Atlas Dev Environment..."

# Step 1: Clean up
bash "$(dirname "$0")/clean.sh"

# Step 2: Start unified backend + frontend
bash "$(dirname "$0")/dev.sh" &
DEV_PID=$!

# Step 3: Wait briefly, then check status
sleep 3
bash "$(dirname "$0")/status.sh"

# Step 4: Confirm process
if ps -p $DEV_PID > /dev/null; then
  echo -e "${GREEN}✅ Atlas restarted successfully on Node 22${NC}"
else
  echo -e "${RED}❌ Atlas failed to restart${NC}"
fi
