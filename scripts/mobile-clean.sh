#!/usr/bin/env bash
set -euo pipefail

echo "🧹 Clean Mobile Setup for Atlas"

# 1) Ensure Node.js 20
if command -v nvm >/dev/null 2>&1; then
  nvm use 20 || true
fi
echo "➡️ Using Node version: $(node -v)"

# 2) Ask which platform
echo ""
echo "Which platform do you want to clean & start?"
select platform in "iOS" "Android" "Cancel"; do
  case $platform in
    iOS ) target="ios"; break;;
    Android ) target="android"; break;;
    Cancel ) echo "❌ Cancelled"; exit 0;;
  esac
done

# 3) Clean root
echo "🧹 Cleaning root..."
rm -rf node_modules .expo .cache package-lock.json yarn.lock pnpm-lock.yaml

# 4) Clean atlas-mobile
cd atlas-mobile
echo "🧹 Cleaning mobile project..."
rm -f metro-terminal-reporter-shim.* fix-metro*.sh TerminalReporter.js metro.config.js || true
rm -rf node_modules .expo .cache

# 5) Write fresh metro.config
cat > metro.config.cjs <<'EOF'
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
module.exports = config;
EOF

# 6) Reinstall deps
echo "📦 Installing dependencies..."
npx expo install --fix

# 7) Start Expo for chosen platform
if [ "$target" == "ios" ]; then
  echo "🚀 Starting iOS Simulator..."
  npx expo start --ios --clear
else
  echo "🚀 Starting Android Emulator..."
  npx expo start --android --clear
fi
