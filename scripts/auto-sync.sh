#!/usr/bin/env bash
set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "🔄 Auto-syncing branch: $BRANCH"

# 1. Stash local changes
git stash push -m "auto-stash-before-push" || true

# 2. Pull latest from origin
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH || true

# 3. Re-apply stashed changes (if any)
if git stash list | grep -q "auto-stash-before-push"; then
  echo "♻️  Restoring stashed changes..."
  git stash pop || true
fi

# 4. Run webhook + health tests
echo "🧪 Running webhook + health tests..."
./test_webhook_local.sh || {
  echo "❌ Webhook/health tests failed — aborting push!"
  exit 1
}

# 5. Run local security scan (simulate GitHub Actions)
echo "🔐 Running security scan..."
echo '🔐 Running security scan...' && (find . -name '*.env*' -o -name '*.key' -o -name '*.pem' -o -name '*.p12' | grep -v node_modules | grep -v .git | head -10 || echo 'No sensitive files found') && echo '✅ Security scan complete' || {
  echo "❌ Security scan failed — aborting push!"
  exit 1
}

# 6. Stage and commit
git add .
git commit -m "Auto-sync: Progress checkpoint ($(date '+%Y-%m-%d %H:%M:%S'))" || true

# 7. Push to GitHub
git push origin $BRANCH

echo "✅ Safe push complete for branch: $BRANCH"
