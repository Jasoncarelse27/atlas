#!/bin/bash
# check-zustand.sh - Zustand + Build Health Check

echo "🔍 Checking Zustand + Build health..."
echo ""

# Check Zustand version
echo "📦 Zustand Installation:"
ZVER=$(npm list zustand 2>/dev/null | grep zustand@ | head -1)
if [ -z "$ZVER" ]; then
  echo "  ⚠️  Zustand not found in node_modules"
else
  echo "  ✅ $ZVER"
fi

echo ""
echo "🧹 Cleaning build artifacts..."
rm -rf node_modules/.vite dist .vite

echo ""
echo "📦 Reinstalling packages..."
npm install --legacy-peer-deps

echo ""
echo "🔨 Rebuilding..."
npm run build

echo ""
echo "✅ Build check complete. Review output for any errors."
echo ""
echo "If build succeeds locally but fails on Vercel:"
echo "  1. Clear Vercel build cache"
echo "  2. Trigger rebuild"

