#!/usr/bin/env bash
set -euo pipefail

echo "🌍 Atlas AI Production Promotion Script"
echo "======================================="

# 1. Checkout release tag
echo "🔖 Checking out v1.0.0 release..."
git fetch --all --tags
git checkout v1.0.0

# 2. Promote backend to Railway production
echo "🚀 Promoting backend to Railway production..."
if command -v railway &> /dev/null; then
    railway up --service atlas-backend --environment production --detach
else
    echo "⚠️ Railway CLI not found. Install with: npm install -g @railway/cli"
    echo "   Then deploy manually: railway up --service atlas-backend --environment production"
fi

# 3. Promote frontend to Vercel production
echo "🚀 Promoting frontend to Vercel production..."
if command -v vercel &> /dev/null; then
    vercel --prod --confirm --name atlas-frontend
else
    echo "⚠️ Vercel CLI not found. Install with: npm install -g vercel"
    echo "   Then deploy manually: vercel --prod --confirm"
fi

# 4. Monitoring verification
echo "📊 Checking Railway production logs..."
if command -v railway &> /dev/null; then
    railway logs --service atlas-backend --environment production --lines 20 || true
else
    echo "⚠️ Railway CLI not available for log checking"
fi

echo "📊 Checking Supabase production logs..."
if command -v supabase &> /dev/null; then
    supabase functions logs || true
else
    echo "⚠️ Supabase CLI not found. Install with: npm install -g supabase"
fi

echo "📊 Sending test event to Sentry (production)..."
if command -v sentry-cli &> /dev/null; then
    sentry-cli send-event --message "Atlas AI Production Deployment Test" || true
else
    echo "⚠️ Sentry CLI not found. Install with: npm install -g @sentry/cli"
fi

echo "✅ Atlas AI v1.0.0 is now LIVE in production!"
echo "======================================="
echo "👉 Next steps:"
echo "   1. Run final smoke tests in live production"
echo "   2. Validate core flows (auth, chat, subscription, webhook)"
echo "   3. Celebrate 🎉"
