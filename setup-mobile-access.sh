#!/bin/bash

# Atlas Mobile Access Setup - Future-Proof Configuration
# This script ensures mobile devices can access Atlas during development

echo "🔧 Setting up Atlas for mobile access..."

# 1. Check if firewall is enabled
FIREWALL_STATUS=$(sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null | grep -o "enabled\|disabled")

if [ "$FIREWALL_STATUS" = "enabled" ]; then
    echo "✅ Firewall is enabled (good for security)"
    echo "📝 Adding Node.js to firewall allow list..."
    
    # Find Node.js path
    NODE_PATH=$(which node)
    
    if [ -n "$NODE_PATH" ]; then
        # Add Node.js to firewall allow list
        sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "$NODE_PATH"
        sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "$NODE_PATH"
        echo "✅ Node.js allowed through firewall: $NODE_PATH"
    else
        echo "❌ Could not find Node.js path"
        exit 1
    fi
else
    echo "⚠️  Firewall is disabled"
fi

# 2. Get local IP address
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)

if [ -z "$LOCAL_IP" ]; then
    echo "❌ Could not detect local IP address"
    exit 1
fi

echo ""
echo "✅ Mobile access configured!"
echo "📱 Access Atlas from mobile at: http://$LOCAL_IP:5174"
echo ""
echo "🔒 Security Notes:"
echo "   - Firewall remains enabled"
echo "   - Only Node.js is allowed through"
echo "   - Access limited to local network only"
echo ""
echo "🚀 Next steps:"
echo "   1. Start Atlas: bash atlas-start.sh"
echo "   2. Open http://$LOCAL_IP:5174 on your mobile device"
echo ""

