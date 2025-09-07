#!/usr/bin/env bash
set -euo pipefail

# --- guards & dirs ---
ROOT_DIR="$(pwd)"
MOBILE_DIR="$ROOT_DIR/atlas-mobile"

if [ ! -d "$MOBILE_DIR" ]; then
  echo "❌ atlas-mobile directory not found at $MOBILE_DIR"; exit 1
fi

# Node 20 guard (informational)
echo "ℹ️ Node version: $(node -v)"

cd "$MOBILE_DIR"

echo "🧹 Cleaning caches & node_modules (mobile only)…"
rm -rf node_modules .expo .cache

# Remove any yarn/npm overrides/resolutions that force Metro versions
# (We only touch the mobile package.json; web stays as-is.)
if command -v jq >/dev/null 2>&1; then
  if [ -f package.json ]; then
    echo "🧽 Removing 'overrides'/'resolutions' (if present) from atlas-mobile/package.json…"
    tmpfile="$(mktemp)"
    jq 'del(.overrides) | del(.resolutions)' package.json > "$tmpfile" && mv "$tmpfile" package.json
  fi
else
  echo "⚠️ jq not found; skipping automatic cleanup of overrides/resolutions."
  echo "   If you manually added Metro overrides in atlas-mobile/package.json, please remove them."
fi

# Ensure Expo picks compatible versions.
echo "⬇️ Installing dependencies (mobile)…"
npm install

# Ask Expo to align packages to what the SDK expects.
# (expo install pins compatible versions for the current Expo SDK)
npx expo install --fix --check || true

echo "🚀 Starting Expo (mobile) with a clear cache…"
npx expo start -c
