#!/bin/bash
# Simple backend restart script for Atlas

echo "🔄 Restarting Atlas Backend..."

# Kill any existing backend processes
pkill -f "node backend/server.mjs" 2>/dev/null || echo "No existing backend processes found"

# Wait for port to be free
sleep 2

# Start backend
cd backend && node server.mjs &

# Wait for startup
sleep 3

# Test health
echo "🏥 Testing backend health..."
if curl -s http://localhost:8000/healthz | jq -r '.status' | grep -q "ok"; then
    echo "✅ Backend restarted successfully!"
    echo "🔗 Health check: http://localhost:8000/healthz"
else
    echo "❌ Backend failed to start"
    exit 1
fi
