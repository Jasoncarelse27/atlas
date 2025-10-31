#!/bin/bash
# Enable all extracted services for testing

ENV_FILE=".env.local"

echo "🔧 Enabling All Extracted Services"
echo "=================================="
echo ""

# Check if .env.local exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating $ENV_FILE..."
    touch "$ENV_FILE"
fi

# Add service flags if they don't exist
add_flag() {
    local flag=$1
    if ! grep -q "$flag" "$ENV_FILE" 2>/dev/null; then
        echo "$flag=true" >> "$ENV_FILE"
        echo "✅ Added: $flag=true"
    else
        echo "⚠️  Already exists: $flag"
        # Update to true if it's false
        sed -i '' "s|$flag=false|$flag=true|g" "$ENV_FILE" 2>/dev/null || sed -i "s|$flag=false|$flag=true|g" "$ENV_FILE" 2>/dev/null
    fi
}

add_flag "VITE_USE_NETWORK_MONITORING_SERVICE"
add_flag "VITE_USE_RETRY_SERVICE"
add_flag "VITE_USE_MESSAGE_PERSISTENCE_SERVICE"
add_flag "VITE_USE_AUDIO_PLAYBACK_SERVICE"
add_flag "VITE_USE_VAD_SERVICE"

echo ""
echo "✅ All services enabled!"
echo ""
echo "📝 Next steps:"
echo "1. Restart dev server: npm run dev"
echo "2. Test voice call"
echo "3. Check console for service logs:"
echo "   - [NetworkMonitoring]"
echo "   - [RetryService]"
echo "   - [MessagePersistence]"
echo "   - [AudioPlayback]"
echo "   - [VAD]"
echo ""

