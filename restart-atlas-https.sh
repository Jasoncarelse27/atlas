#!/bin/bash
# 🔄 Atlas HTTPS Restart Script
# Kills old processes and restarts frontend/backend with HTTPS

echo "🛑 Stopping old Atlas processes..."
pkill -f "node.*vite" 2>/dev/null
pkill -f "node.*server.mjs" 2>/dev/null
sleep 2

echo "✅ Old processes stopped"
echo ""
echo "🚀 Starting Atlas with HTTPS..."
echo ""
echo "📋 Next steps:"
echo "   1. Open TWO terminal windows"
echo "   2. In Terminal 1: cd backend && node server.mjs"
echo "   3. In Terminal 2: npm run dev"
echo ""
echo "   Frontend will be at: https://localhost:5174"
echo "   Backend will be at: http://localhost:8000"
echo ""
echo "💡 Tip: If voice calls crash, set VITE_VOICE_STREAMING_ENABLED=false in .env"

