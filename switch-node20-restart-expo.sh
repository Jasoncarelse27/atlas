#!/usr/bin/env bash
set -euo pipefail

echo "🔄 Switching to Node.js 20 LTS and restarting Expo mobile..."

# 1. Use Node 20 (via nvm if available, else brew)
if command -v nvm >/dev/null 2>&1; then
  nvm install 20
  nvm use 20
else
  brew install node@20 || true
  brew unlink node@22 || true
  brew link --overwrite --force node@20
fi

# 2. Navigate to mobile project
cd atlas/atlas-mobile

# 3. Clean old installs & caches
rm -rf node_modules .expo .cache

# 4. Fresh install
npm install

# 5. Start Expo mobile dev server
npm run dev:mobile
