#!/bin/bash
# Force Node 22 from NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22 > /dev/null

# Atlas Dev Status Checker

BACKEND_PORT=3000
FRONTEND_PORT=5173

echo "🔍 Checking Atlas Dev Environment..."

check_port() {
  local port=$1
  local name=$2
  if lsof -i :$port >/dev/null; then
    echo "✅ $name running on port $port"
  else
    echo "❌ $name not running"
  fi
}

check_port $BACKEND_PORT "Backend"
check_port $FRONTEND_PORT "Frontend"
