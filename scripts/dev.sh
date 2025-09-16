#!/bin/bash
# Force Node 22 from NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22 > /dev/null

# Unified Atlas Dev Launcher (Future-Proof + Auto-Restart + Colored Logs)

BACKEND_PORT=3000
FRONTEND_PORT=5173

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}🚀 Starting Atlas Unified Dev Launcher...${NC}"

# Cleanup old processes
echo -e "${YELLOW}🧹 Cleaning up ports $BACKEND_PORT and $FRONTEND_PORT...${NC}"
lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true

# Start backend
echo -e "${GREEN}▶️  Starting Backend on :$BACKEND_PORT${NC}"
npm run dev:backend &

# Start frontend
echo -e "${CYAN}▶️  Starting Frontend on :$FRONTEND_PORT${NC}"
npm run dev:frontend &

BACKEND_PID=$!
FRONTEND_PID=$!

trap "echo -e '${RED}🛑 Shutting down Atlas Dev...${NC}'; kill $BACKEND_PID $FRONTEND_PID" SIGINT SIGTERM
wait
