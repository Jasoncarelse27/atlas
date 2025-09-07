#!/usr/bin/env bash
set -euo pipefail

echo "⏹️ Stopping any running Expo/Metro processes…"
pkill -f "expo start" || true
pkill -f "[m]etro" || true

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
MOBILE_DIR="${REPO_ROOT}/atlas-mobile"

if [ ! -d "$MOBILE_DIR" ]; then
  echo "❌ Could not find ${MOBILE_DIR}. Update MOBILE_DIR if your mobile folder differs."
  exit 1
fi

echo "🔎 Using mobile directory: ${MOBILE_DIR}"
cd "$MOBILE_DIR"

echo "🧹 Backing up and removing any custom Metro patches/shims…"
# Backup any custom metro config/shims we may have created earlier
for f in metro.config.js metro.config.cjs metro.config.mjs metro.config.ts \
         metro-terminal-reporter-shim.cjs; do
  if [ -f "$f" ]; then
    cp -n "$f" "${f}.bak.$(date +%Y%m%d-%H%M%S)" || true
  fi
done

# Recreate a standard Expo metro config
cat > metro.config.cjs <<'EOF'
/**
 * Standard Expo Metro config.
 * If you need customizations later, start from this baseline.
 */
const { getDefaultConfig } = require('expo/metro-config');
const projectRoot = __dirname;
module.exports = getDefaultConfig(projectRoot);
EOF

echo "🧽 Clearing caches and node_modules (mobile only)…"
rm -rf node_modules .expo .cache
# If you use watchman:
command -v watchman >/dev/null 2>&1 && watchman watch-del-all || true

echo "📦 Installing base deps (respects package-lock/pnpm-lock/yarn.lock)…"
# Use the same package manager your repo uses; defaulting to npm here.
npm install

echo "🧰 Aligning dependencies to the correct SDK set (Expo magic)…"
# This reconciles React Native/Metro and friends to the versions your Expo SDK expects.
npx expo install --fix --non-interactive || true

# Some CLIs still need a second pass after install changes:
echo "📦 Reinstall after fixes to ensure lockfile consistency…"
npm install

echo "🧹 Verifying no stale Expo caches remain…"
rm -rf .expo .cache node_modules/.cache || true

echo "🚀 Starting Expo cleanly (foreground)…"
# Use --clear to ensure Metro starts without stale caches.
npx expo start --clear
