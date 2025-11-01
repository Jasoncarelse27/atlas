#!/bin/bash
# Simple Fly.io Setup Script for Voice V2

set -e

APP_NAME="atlas-voice-v2"

echo "🚀 Fly.io Setup for Atlas Voice V2"
echo ""

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
  echo "❌ flyctl not found!"
  echo ""
  echo "Please install it first:"
  echo "  brew install flyctl"
  echo ""
  echo "Or visit: https://fly.io/docs/hands-on/install-flyctl/"
  exit 1
fi

echo "✅ flyctl found: $(flyctl version)"
echo ""

# Check if logged in
if ! flyctl auth whoami &> /dev/null; then
  echo "❌ Not logged in to Fly.io"
  echo ""
  echo "Please login first:"
  echo "  flyctl auth login"
  exit 1
fi

echo "✅ Logged in as: $(flyctl auth whoami)"
echo ""

# Check if app exists
if flyctl apps list 2>/dev/null | grep -q "$APP_NAME"; then
  echo "✅ App '$APP_NAME' already exists"
else
  echo "📦 Creating app '$APP_NAME'..."
  flyctl apps create "$APP_NAME" --org personal
  echo "✅ App created!"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Go to: https://fly.io/tokens/create"
echo "2. Select app: $APP_NAME"
echo "3. Create token"
echo "4. Add to GitHub Secrets as FLY_API_TOKEN"
echo ""
echo "Or run full deployment:"
echo "  ./deploy-multi-region.sh"

