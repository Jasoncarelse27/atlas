#!/usr/bin/env bash
set -euo pipefail

# Atlas AI Sentry Release Management Script
# Usage: ./scripts/sentry-release.sh [version]

VERSION=${1:-v1.0.0}
PROJECT_NAME="atlas-ai"

echo "🚀 Creating Sentry release for Atlas AI $VERSION..."

# Check if Sentry CLI is installed
if ! command -v sentry-cli &> /dev/null; then
    echo "❌ Sentry CLI not found. Install with: npm install -g @sentry/cli"
    exit 1
fi

# Create release
echo "📦 Creating release $VERSION..."
sentry-cli releases new $VERSION

# Upload source maps (if build exists)
if [ -d "dist" ]; then
    echo "🗺️ Uploading source maps..."
    sentry-cli releases files $VERSION upload-sourcemaps dist --url-prefix "~/static/js/"
else
    echo "⚠️ No dist folder found. Run 'npm run build' first for source maps."
fi

# Set release as deployed
echo "🚀 Marking release as deployed..."
sentry-cli releases deploys $VERSION new --env production

# Create a test event
echo "🧪 Sending test event to verify monitoring..."
sentry-cli send-event --message "Atlas AI $VERSION Production Release Test" --release $VERSION || true

echo "✅ Sentry release $VERSION configured successfully!"
echo "📊 View at: https://sentry.io/organizations/atlas-ai/projects/$PROJECT_NAME/releases/$VERSION/"
