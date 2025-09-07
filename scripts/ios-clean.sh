#!/usr/bin/env bash
set -euo pipefail

echo "🧹 Cleaning & restarting Atlas iOS..."

# 1) Use Node 20 for mobile (via nvm if available)
if command -v nvm >/dev/null 2>&1; then
  nvm use 20 || true
fi
node -v

# 2) Hard clean root
rm -rf node_modules .expo .cache package-lock.json yarn.lock pnpm-lock.yaml

# 3) Reset atlas-mobile to Expo defaults
cd atlas-mobile

rm -f metro-terminal-reporter-shim.* metro-terminal-reporter-shim.cjs \
      fix-metro*.sh TerminalReporter.js metro.config.js || true
rm -rf node_modules .expo .cache

# Write a fresh Expo Metro config
cat > metro.config.cjs <<'EOF'
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
module.exports = config;
EOF

# 4) Reinstall pinned dependencies
npx expo install --fix

# 5) Start iOS simulator with clear cache
npx expo start --ios --clear
