#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting Atlas deployment with new Railway token..."

# Step 1: Create and push new tag
TAG="v1.0.14"
MSG="Fix: update Railway token"
git tag -a $TAG -m "$MSG"
git push origin $TAG
echo "✅ Created and pushed tag $TAG"

# Step 2: Show latest GitHub Actions run for this repo
echo "⏳ Waiting for GitHub Actions to start..."
sleep 10
open "https://github.com/Jasoncarelse27/atlas/actions"
