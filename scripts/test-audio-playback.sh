#!/bin/bash
# Script to test AudioPlaybackService in standard (non-streaming) mode

echo "🎵 Testing AudioPlaybackService"
echo "==============================="
echo ""
echo "⚠️  Note: AudioPlaybackService only works in STANDARD mode (not streaming)"
echo ""
echo "📋 Steps:"
echo "1. Disable streaming mode:"
echo "   VITE_VOICE_STREAMING_ENABLED=false"
echo ""
echo "2. Restart dev server: npm run dev"
echo ""
echo "3. Start voice call (will use standard mode)"
echo ""
echo "4. Check console for [AudioPlayback] logs:"
echo "   [AudioPlayback] ✅ Audio playing"
echo "   [AudioPlayback] Audio playback ended"
echo ""

# Check current state
if grep -q "VITE_VOICE_STREAMING_ENABLED=true" .env.local 2>/dev/null; then
    echo "⚠️  Streaming mode is ENABLED"
    echo "   AudioPlaybackService won't be used (audioQueueService handles streaming)"
    echo ""
    echo "💡 To test AudioPlaybackService:"
    echo "   Set VITE_VOICE_STREAMING_ENABLED=false in .env.local"
else
    echo "✅ Streaming mode is DISABLED"
    echo "   AudioPlaybackService will be used"
fi

echo ""
echo "✅ AudioPlaybackService flag:"
grep "VITE_USE_AUDIO_PLAYBACK_SERVICE=true" .env.local 2>/dev/null && echo "  ✅ Enabled" || echo "  ❌ Not enabled"

