#!/bin/bash

# Atlas Golden Standard Cleanup Script
# Kills all backend + Vite instances, frees ports, and restarts cleanly

echo "🧹 Atlas Cleanup - Starting backend reset..."

# Kill all Node/backend/Vite processes
pkill -f "node backend/server.mjs" || true
pkill -f "nodemon backend/server.mjs" || true
pkill -f "vite" || true

# Wait for processes to clean up
sleep 2

# Force kill any remaining processes on ports
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :5174 | xargs kill -9 2>/dev/null || true

echo "✅ Ports 8000 & 5174 cleaned"

# Check if user wants frontend restart too
if [ "$1" = "--full" ] || [ "$1" = "-f" ]; then
    echo "🚀 Starting backend and frontend..."
    npm run dev:backend &
    sleep 5
    npm run dev:web
else
    echo "🚀 Starting backend only..."
    npm run dev:backend
fi

echo "✅ Atlas cleanup complete!"
