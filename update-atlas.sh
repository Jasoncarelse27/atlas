#!/usr/bin/env bash
set -euo pipefail

echo "🔄 Updating Atlas app from GitHub…"

# 0) Go to your project
cd ~/atlas/atlas-mobile

# 1) Verify repo + remote
git rev-parse --is-inside-work-tree >/dev/null
git remote get-url origin >/dev/null

# 2) Make sure we're on main and tracking origin/main
git checkout main
git fetch --prune origin
# If main has no upstream yet, set it
git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1 || \
  git branch --set-upstream-to=origin/main main

# 3) Commit package-lock.json if present
if [ -f package-lock.json ]; then
  git add package-lock.json
  git commit -m "chore: add/update package-lock.json" || echo "ℹ️ No changes in package-lock.json"
fi

# 4) Stash any other local edits (keeps working tree safe)
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "🧳 Stashing local changes..."
  git stash push -u -m "pre-pull-auto-stash"
  STASHED=1
else
  STASHED=0
fi

# 5) Pull with rebase for a clean, linear history
echo "⬇️ Pulling latest (rebase)…"
git pull --rebase origin main

# 6) Re-apply stashed work if we stashed
if [ "$STASHED" -eq 1 ]; then
  echo "♻️ Restoring stashed changes…"
  git stash pop || true
fi

# 7) Install deps deterministically
if [ -f package-lock.json ]; then
  echo "📦 npm ci (using lockfile)…"
  npm ci
elif [ -f package.json ]; then
  echo "📦 npm install…"
  npm install
else
  echo "⚠️ No package.json found — skipping install"
fi

# 8) Start backend
echo "🚀 Starting Atlas backend…"
npm run dev
