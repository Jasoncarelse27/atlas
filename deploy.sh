#!/bin/bash

# 🚀 Atlas Production Deployment Script
# Run this to deploy Atlas to production with full monitoring

echo "🚀 ATLAS PRODUCTION DEPLOYMENT"
echo "================================"
echo ""

# Step 1: Check git status
echo "📋 Step 1: Checking git status..."
git status

echo ""
echo "🔍 Uncommitted files above will NOT be deployed"
echo ""
read -p "Do you want to commit these changes? (y/n): " commit_choice

if [ "$commit_choice" = "y" ]; then
  echo ""
  read -p "Enter commit message: " commit_msg
  git add -A
  git commit -m "$commit_msg"
  echo "✅ Changes committed"
fi

echo ""
echo "📤 Step 2: Pushing to GitHub (triggers deployment)..."
git push origin main

echo ""
echo "✅ DEPLOYMENT INITIATED!"
echo ""
echo "📊 Next Steps:"
echo "1. Check GitHub Actions: https://github.com/YOUR_REPO/actions"
echo "2. Monitor Sentry: https://otium-creations.sentry.io/issues/"
echo "3. Check Railway deployment: https://railway.app"
echo ""
echo "🎉 Atlas is deploying to production with enterprise monitoring!"
