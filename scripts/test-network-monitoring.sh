#!/bin/bash
# Script to test NetworkMonitoringService by simulating network changes

echo "🌐 Testing NetworkMonitoringService"
echo "===================================="
echo ""
echo "📋 Instructions:"
echo "1. Open Chrome DevTools (F12)"
echo "2. Go to Network tab"
echo "3. Set throttling to 'Slow 3G' or 'Offline'"
echo "4. Start a voice call"
echo "5. Watch console for [NetworkMonitoring] logs"
echo ""
echo "Expected logs:"
echo "  [NetworkMonitoring] 🌐 Network quality: excellent → poor"
echo "  [NetworkMonitoring] 🌐 Network quality: poor → excellent"
echo ""
echo "✅ NetworkMonitoringService is enabled:"
grep "VITE_USE_NETWORK_MONITORING_SERVICE=true" .env.local 2>/dev/null && echo "  ✅ Enabled" || echo "  ❌ Not enabled (run ./scripts/enable-all-services.sh)"
echo ""

