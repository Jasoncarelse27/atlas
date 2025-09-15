#!/usr/bin/env bash
set -euo pipefail

echo "🔄 Creating Git checkpoint for Slack Alerts integration..."

# Step 1: Ensure we're on main
git checkout main

# Step 2: Stash any local changes (if any, just in case)
git stash push -m "auto-stash-before-slack-checkpoint" || true

# Step 3: Pull latest to avoid conflicts
git pull origin main

# Step 4: Restore stashed changes (if there were any)
if git stash list | grep -q "auto-stash-before-slack-checkpoint"; then
  git stash pop || true
fi

# Step 5: Add CI/CD workflow updates
git add .github/workflows/

# Step 6: Commit with clear message
git commit -m "chore(ci): finalize Slack alerts integration (staging + prod webhooks working)" || echo "✅ Nothing to commit"

# Step 7: Push to GitHub
git push origin main

# Step 8: Create a tagged checkpoint
TAG="v1.3.0-slack-alerts"
git tag -a "$TAG" -m "Slack alerts fully integrated (staging + prod working)"
git push origin "$TAG"

echo "🎉 Checkpoint complete: $TAG pushed to GitHub"
