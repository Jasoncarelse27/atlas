#!/bin/bash
# Deploy Voice V2 to Fly.io

set -e

echo "🚀 Deploying Voice V2 to Fly.io..."
echo ""

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
  echo "❌ flyctl not found. Please install it:"
  echo "   brew install flyctl"
  echo "   Or visit: https://fly.io/docs/hands-on/install-flyctl/"
  exit 1
fi

# Check if logged in
if ! flyctl auth whoami &> /dev/null; then
  echo "❌ Not logged in to Fly.io"
  echo "   Run: flyctl auth login"
  exit 1
fi

# Set secrets
echo "📝 Setting secrets..."
flyctl secrets set \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  DEEPGRAM_API_KEY="$DEEPGRAM_API_KEY" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  --app atlas-voice-v2

# Deploy
echo "🚀 Deploying to Fly.io..."
flyctl deploy --app atlas-voice-v2

# Health check
echo ""
echo "🔍 Running health check..."
sleep 5
HEALTH_URL="https://atlas-voice-v2.fly.dev/health"
if curl -f "$HEALTH_URL" > /dev/null 2>&1; then
  echo "✅ Health check passed"
else
  echo "⚠️  Health check failed, but deployment may still be in progress"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Voice V2 WebSocket URL:"
echo "   wss://atlas-voice-v2.fly.dev"
echo ""
echo "📊 View logs:"
echo "   flyctl logs --app atlas-voice-v2"
echo ""
echo "📈 View dashboard:"
echo "   flyctl dashboard --app atlas-voice-v2"

