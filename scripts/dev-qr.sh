#!/bin/bash

# Get your local LAN IP (works on macOS/Linux)
IP=$(ipconfig getifaddr en0 2>/dev/null || ip a | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -n 1)

PORT=5174
URL="http://$IP:$PORT"

echo "🚀 Starting Atlas dev server..."
echo "📱 Mobile URL: $URL"
echo ""

# Kill any existing Vite processes
pkill -f "vite" 2>/dev/null || true

# Run Vite in the background
npm run dev &

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 8

# Check if server is running
if curl -s http://localhost:$PORT > /dev/null; then
    echo "✅ Server is running!"
    echo ""
    echo "📱 Scan this QR code on your mobile device to open Atlas:"
    echo ""
    
    # Show QR code
    node -e "const qrcode = require('qrcode-terminal'); qrcode.generate('$URL');"
    
    echo ""
    echo "✅ Server running at: $URL"
    echo "📱 Scan the QR code above with your mobile device"
    echo "🛑 Press Ctrl+C to stop the server"
    echo ""
else
    echo "❌ Server failed to start. Check the logs above."
    exit 1
fi

# Keep process running in foreground
wait
