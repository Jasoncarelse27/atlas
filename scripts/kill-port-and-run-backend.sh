#!/bin/bash

# 🚀 Atlas AI Backend Port Manager
# Automatically clears port 8000 and starts the backend server

set -e  # Exit on any error

echo "🔍 Checking port 8000 status..."

# Check if port 8000 is in use
if lsof -i :8000 > /dev/null 2>&1; then
    echo "⚠️  Port 8000 is in use. Clearing processes..."
    
    # Kill all processes using port 8000
    lsof -ti :8000 | xargs kill -9 2>/dev/null || true
    
    # Wait a moment for processes to fully terminate
    sleep 1
    
    # Verify port is free
    if lsof -i :8000 > /dev/null 2>&1; then
        echo "❌ Failed to clear port 8000. Trying force kill..."
        lsof -ti :8000 | xargs kill -9 -9 2>/dev/null || true
        sleep 2
    fi
    
    echo "✅ Port 8000 cleared successfully!"
else
    echo "✅ Port 8000 is free"
fi

# Verify port is actually free before proceeding
if lsof -i :8000 > /dev/null 2>&1; then
    echo "❌ Port 8000 is still in use. Cannot start backend."
    echo "🔍 Check what's using the port: lsof -i :8000"
    exit 1
fi

echo "🚀 Starting Atlas AI Backend Server..."
echo "📁 Working directory: $(pwd)"
echo "🔗 Server will be available at: http://localhost:8000"
echo "📊 Health check: http://localhost:8000/healthz"
echo ""

# Start the backend server
cd backend && npm run dev
