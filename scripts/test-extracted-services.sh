#!/bin/bash
# Test Script for Extracted Voice Services
# Tests each extracted service individually and together

set -e

echo "🧪 Testing Extracted Voice Services"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "${YELLOW}⚠️  .env.local not found. Creating it...${NC}"
    touch .env.local
fi

echo "📋 Current Feature Flags:"
echo "------------------------"
grep -E "VITE_USE_.*_SERVICE" .env.local 2>/dev/null || echo "No service flags found"
echo ""

echo "🔍 Checking Service Files:"
echo "---------------------------"
SERVICES=(NetworkMonitoringService RetryService MessagePersistenceService AudioPlaybackService VADService)
for service in "${SERVICES[@]}"; do
    if [ -f "src/services/voice/${service}.ts" ]; then
        echo "✅ ${service}.ts exists"
    else
        echo "❌ ${service}.ts NOT FOUND"
    fi
done
echo ""

echo "🧪 Running Unit Tests:"
echo "----------------------"
npm test -- src/services/voice/__tests__/ --run 2>&1 | grep -E "(Test Files|Tests|passed|failed)" | head -5
echo ""

echo "✅ Test script complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Enable feature flags in .env.local:"
echo "   VITE_USE_NETWORK_MONITORING_SERVICE=true"
echo "   VITE_USE_RETRY_SERVICE=true"
echo "   VITE_USE_MESSAGE_PERSISTENCE_SERVICE=true"
echo "   VITE_USE_AUDIO_PLAYBACK_SERVICE=true"
echo "   VITE_USE_VAD_SERVICE=true"
echo ""
echo "2. Start dev server: npm run dev"
echo "3. Test voice call and check console for service logs"
echo ""

