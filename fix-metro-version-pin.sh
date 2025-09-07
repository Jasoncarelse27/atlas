#!/usr/bin/env bash
set -euo pipefail

MOBILE_DIR="atlas-mobile"

# repo root → mobile dir
git rev-parse --show-toplevel >/dev/null 2>&1 && cd "$(git rev-parse --show-toplevel)"
[ -d "$MOBILE_DIR" ] || { echo "❌ '$MOBILE_DIR' not found"; exit 1; }
cd "$MOBILE_DIR"

# Show current versions (for your logs)
echo "🧭 Current versions:"
node -e "try{console.log('expo-cli =', require('@expo/cli/package.json').version)}catch{}"
node -e "try{console.log('metro =', require('metro/package.json').version)}catch{}"

# Pin a Metro family known to expose a TerminalReporter class via metro-core.
# (If you've already tried 0.83.x, step back to 0.79.x which is broadly compatible with many Expo SDKs.)
echo "📌 Pinning Metro family to 0.79.x (override only in mobile app)"
npm pkg set "overrides.metro=0.79.1" \
            "overrides.metro-core=0.79.1" \
            "overrides.metro-config=0.79.1" \
            "overrides.metro-resolver=0.79.1" \
            "overrides.metro-runtime=0.79.1"

# Optional: remove any prior shims/patches you added (they can mask results)
rm -f node_modules/metro/src/lib/TerminalReporter.js || true
rm -rf patches || true  # if you used patch-package earlier

echo "🧹 Reinstalling deps and clearing caches…"
rm -rf node_modules package-lock.json .expo .cache node_modules/.cache
npm i

# Verify what we ended up with
node -e "console.log('resolved metro =', require('metro/package.json').version)"
node -e "console.log('resolved metro-core =', require('metro-core/package.json').version)"

echo "📱 Starting Expo (mobile)…"
cd ..
npm run dev:mobile
