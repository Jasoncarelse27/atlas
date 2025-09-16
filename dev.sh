#!/bin/bash
# Unified Atlas Dev Launcher (Future-Proof + Auto-Restart + Status Integration)

BACKEND_PORT=3000
FRONTEND_PORT=5173

echo "🚀 Starting Atlas Dev Environment..."
echo "-----------------------------------"

# Kill stale processes
lsof -ti:$BACKEND_PORT -sTCP:LISTEN | xargs kill -9 2>/dev/null
lsof -ti:$FRONTEND_PORT -sTCP:LISTEN | xargs kill -9 2>/dev/null

# Run backend + frontend together
concurrently \
  "nodemon backend/server.mjs" \
  "vite" \
  --kill-others-on-fail --prefix-colors "bgBlue.bold,bgGreen.bold"

# If we exit/crash, run status check
echo "💥 Atlas Dev Environment crashed or exited!"
echo "🔍 Running status check..."
bash scripts/status.sh

echo "🛠 Tip: Run 'bash scripts/clean.sh' if ports stay locked."
echo "✅ Scripts ready and executable"
