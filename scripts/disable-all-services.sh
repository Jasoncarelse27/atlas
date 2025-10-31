#!/bin/bash
# Disable all extracted services (use legacy code)

ENV_FILE=".env.local"

echo "🔧 Disabling All Extracted Services (Using Legacy)"
echo "=================================================="
echo ""

if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  .env.local not found. Nothing to disable."
    exit 0
fi

# Disable all service flags
sed -i '' "s|VITE_USE_NETWORK_MONITORING_SERVICE=true|VITE_USE_NETWORK_MONITORING_SERVICE=false|g" "$ENV_FILE" 2>/dev/null || sed -i "s|VITE_USE_NETWORK_MONITORING_SERVICE=true|VITE_USE_NETWORK_MONITORING_SERVICE=false|g" "$ENV_FILE" 2>/dev/null
sed -i '' "s|VITE_USE_RETRY_SERVICE=true|VITE_USE_RETRY_SERVICE=false|g" "$ENV_FILE" 2>/dev/null || sed -i "s|VITE_USE_RETRY_SERVICE=true|VITE_USE_RETRY_SERVICE=false|g" "$ENV_FILE" 2>/dev/null
sed -i '' "s|VITE_USE_MESSAGE_PERSISTENCE_SERVICE=true|VITE_USE_MESSAGE_PERSISTENCE_SERVICE=false|g" "$ENV_FILE" 2>/dev/null || sed -i "s|VITE_USE_MESSAGE_PERSISTENCE_SERVICE=true|VITE_USE_MESSAGE_PERSISTENCE_SERVICE=false|g" "$ENV_FILE" 2>/dev/null
sed -i '' "s|VITE_USE_AUDIO_PLAYBACK_SERVICE=true|VITE_USE_AUDIO_PLAYBACK_SERVICE=false|g" "$ENV_FILE" 2>/dev/null || sed -i "s|VITE_USE_AUDIO_PLAYBACK_SERVICE=true|VITE_USE_AUDIO_PLAYBACK_SERVICE=false|g" "$ENV_FILE" 2>/dev/null
sed -i '' "s|VITE_USE_VAD_SERVICE=true|VITE_USE_VAD_SERVICE=false|g" "$ENV_FILE" 2>/dev/null || sed -i "s|VITE_USE_VAD_SERVICE=true|VITE_USE_VAD_SERVICE=false|g" "$ENV_FILE" 2>/dev/null

echo "✅ All services disabled (legacy code will be used)"
echo ""
echo "📝 Next steps:"
echo "1. Restart dev server: npm run dev"
echo "2. Test voice call"
echo "3. Verify legacy [VoiceCall] logs appear"
echo ""

