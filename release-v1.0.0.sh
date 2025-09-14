#!/usr/bin/env bash
set -euo pipefail

echo "🔄 Preparing Atlas v1.0.0 Release..."

# 1. Ensure you're on main and up-to-date
git checkout main
git pull origin main

# 2. Create a release branch
git checkout -b release-v1.0.0

# 3. Add a release tag
git tag -a v1.0.0 -m "🚀 Atlas v1.0.0 Production Release (Node 22 + Vitest 3 + MSW 2)"

# 4. Push branch and tag to GitHub
git push origin release-v1.0.0
git push origin v1.0.0

echo "✅ Release branch and tag pushed!"

# 5. Trigger production deploy
echo "🚀 Triggering Production Deploys..."

# Railway backend deploy
railway up --service atlas-backend || echo "⚠️ Make sure Railway CLI is logged in!"

# Vercel frontend deploy
vercel --prod || echo "⚠️ Make sure Vercel CLI is logged in!"

echo "🎉 Atlas v1.0.0 release deployed to production!"
