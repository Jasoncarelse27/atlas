#!/bin/bash
# Safe Frontend Server Startup Script

set -e  # Exit on error

cd "$(dirname "$0")"

echo "🚀 Starting Atlas Frontend Server..."
echo ""

# Check Node version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Error: Node.js v20+ required (found: $(node --version))"
  exit 1
fi

# Check dependencies
if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules not found. Installing dependencies..."
  npm install
fi

# Clear port if needed
if lsof -ti:5174 >/dev/null 2>&1; then
  echo "⚠️  Port 5174 is in use. Clearing..."
  lsof -ti:5174 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# Start server
echo "✅ Starting Vite dev server on port 5174..."
echo ""
echo "📝 Server will be available at:"
echo "   http://localhost:5174"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev




