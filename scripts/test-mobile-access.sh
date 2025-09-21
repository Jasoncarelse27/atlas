#!/bin/bash

echo "📱 Atlas Mobile Access Test"
echo "=========================="
echo ""

# Get the correct local IP
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
echo "🔍 Detected local IP: $LOCAL_IP"

# Test server connectivity
echo ""
echo "📡 Testing server connectivity..."
if curl -s "http://localhost:5174" > /dev/null; then
    echo "✅ Local server running on port 5174"
else
    echo "❌ Local server not running on port 5174"
    exit 1
fi

if curl -s "http://$LOCAL_IP:5174" > /dev/null; then
    echo "✅ Network server accessible on $LOCAL_IP:5174"
else
    echo "❌ Network server not accessible on $LOCAL_IP:5174"
    exit 1
fi

echo ""
echo "📱 Mobile Testing URLs:"
echo "   Desktop: http://localhost:5174"
echo "   Mobile:  http://$LOCAL_IP:5174"
echo ""

# Generate QR code if available
if command -v qrcode-terminal > /dev/null; then
    echo "📱 QR Code for mobile access:"
    qrcode-terminal "http://$LOCAL_IP:5174"
else
    echo "💡 Install qrcode-terminal for QR codes: npm install -g qrcode-terminal"
fi

echo ""
echo "🧪 Test Steps:"
echo "1. Open http://$LOCAL_IP:5174 on your mobile device"
echo "2. Should see Atlas login page (not blank white)"
echo "3. Login with test account"
echo "4. Navigate to chat interface"
echo "5. Test + button menu functionality"
echo ""
echo "✅ Ready for mobile testing!"
