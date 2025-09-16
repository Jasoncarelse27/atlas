#!/bin/bash
# Force Node 22 from NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22 > /dev/null

# Atlas Nuclear Cleanup Script

echo "🧹 Running Atlas Clean Reset..."

# Kill anything on dev ports
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Clear caches
echo "🗑️  Removing caches..."
rm -rf node_modules/.cache
rm -rf .vite
rm -rf dist
rm -rf .turbo
rm -rf .expo

# Optional: reset node_modules if really broken
if [[ "$1" == "--hard" ]]; then
  echo "💣 HARD RESET: removing node_modules + lock files"
  rm -rf node_modules
  rm -f package-lock.json yarn.lock pnpm-lock.yaml
  npm install
fi

echo "✅ Atlas cleanup complete. Try again with: npm run atlas"
