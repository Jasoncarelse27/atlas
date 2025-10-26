#!/bin/bash

# 🎯 Pre-Deployment Environment Check
# Verifies all production env vars are set

echo "🔍 ATLAS PRODUCTION ENVIRONMENT CHECK"
echo "======================================"
echo ""

# Check .env.production
if [ ! -f .env.production ]; then
  echo "❌ ERROR: .env.production not found!"
  exit 1
fi

echo "✅ .env.production exists"
echo ""
echo "📋 Checking critical environment variables..."
echo ""

# Required variables
REQUIRED_VARS=(
  "VITE_SENTRY_DSN"
  "VITE_APP_ENV"
  "VITE_SUPABASE_URL"
  "VITE_SUPABASE_ANON_KEY"
  "VITE_API_URL"
)

missing=0

for var in "${REQUIRED_VARS[@]}"; do
  if grep -q "^${var}=" .env.production; then
    echo "✅ $var is set"
  else
    echo "❌ $var is MISSING!"
    missing=$((missing + 1))
  fi
done

echo ""

if [ $missing -eq 0 ]; then
  echo "🎉 ALL REQUIRED VARIABLES ARE SET!"
  echo ""
  echo "✅ Ready to deploy to production"
  echo ""
  echo "Run: ./deploy.sh"
else
  echo "⚠️  $missing variable(s) missing!"
  echo ""
  echo "Fix .env.production before deploying"
  exit 1
fi

