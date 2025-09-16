#!/bin/bash
set -euo pipefail

echo "🚀 Starting Atlas Unified Dev Environment..."

# Kill any old processes to prevent port conflicts
echo "🧹 Cleaning up old processes..."
lsof -ti:3000 | xargs kill -9 || true
lsof -ti:5173 | xargs kill -9 || true

# Wait a moment for ports to be released
sleep 1

echo "🔧 Starting backend and frontend in parallel..."

# Start backend + frontend in parallel
concurrently \
  "npm run dev:backend" \
  "npm run dev:frontend"
