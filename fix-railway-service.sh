#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Fixing GitHub Actions deploy.yml to use correct Railway service name..."

# Ensure we are on main
git checkout main

# Stash any local changes (just in case)
git stash push -m "pre-service-name-fix" || true

# Create a new branch for the fix
BRANCH="fix/railway-service-name"
git checkout -B $BRANCH

# Update the deploy.yml workflow
WORKFLOW_FILE=".github/workflows/deploy.yml"

if [ -f "$WORKFLOW_FILE" ]; then
  sed -i.bak 's/atlas-backend/atlas/g' "$WORKFLOW_FILE"
  rm -f "$WORKFLOW_FILE.bak"
  echo "✅ Updated service name in $WORKFLOW_FILE"
else
  echo "❌ Could not find $WORKFLOW_FILE"
  exit 1
fi

# Commit the fix
git add "$WORKFLOW_FILE"
git commit -m "fix: correct Railway service name to atlas"

# Push the branch
git push origin $BRANCH --force

# Merge into main
git checkout main
git merge $BRANCH --no-edit

# Push to main
git push origin main

echo "🚀 Fix applied and pushed. GitHub Actions will now redeploy with the correct service name."
