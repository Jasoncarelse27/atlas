#!/bin/bash

echo "🔧 Atlas Keyboard-Safe Debug Script"
echo "=================================="
echo ""

# Check if server is running
echo "📡 Checking if Atlas server is running..."
if curl -s "http://localhost:5174" > /dev/null; then
    echo "✅ Frontend server running on port 5174"
else
    echo "❌ Frontend server not running on port 5174"
    echo "   Run: npm run dev"
    exit 1
fi

# Check if backend is running
echo "📡 Checking if backend server is running..."
if curl -s "http://localhost:3000/ping" > /dev/null; then
    echo "✅ Backend server running on port 3000"
else
    echo "❌ Backend server not running on port 3000"
    echo "   Run: npm run dev:backend"
    exit 1
fi

# Get local IP for mobile testing
echo ""
echo "📱 Mobile Testing URLs:"
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
if [ ! -z "$LOCAL_IP" ]; then
    echo "   Mobile URL: http://$LOCAL_IP:5174"
    echo "   QR Code:"
    if command -v qrcode-terminal > /dev/null; then
        qrcode-terminal "http://$LOCAL_IP:5174"
    else
        echo "   Install qrcode-terminal: npm install -g qrcode-terminal"
    fi
else
    echo "   Could not detect local IP"
fi

echo ""
echo "🧪 Testing Checklist:"
echo "1. Desktop: http://localhost:5174"
echo "2. Mobile: http://$LOCAL_IP:5174"
echo "3. Follow: MOBILE_KEYBOARD_TESTING_CHECKLIST.md"
echo ""
echo "🔍 Debug Tips:"
echo "- Open browser DevTools → Console tab"
echo "- Look for '📱 [Keyboard]' log messages"
echo "- Test on both portrait and landscape"
echo "- Try different input field interactions"
echo ""
echo "✅ Ready for testing!"
