#!/bin/bash
# Deploy Voice V2 to Fly.io - Multi-Region (US + EU)

set -e

APP_NAME="atlas-voice-v2"
US_REGION="iad"   # Washington DC
EU_REGION="fra"   # Frankfurt

echo "🚀 Deploying Voice V2 to Fly.io (Multi-Region)..."
echo ""

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
  echo "❌ flyctl not found. Please install it:"
  echo "   brew install flyctl"
  exit 1
fi

# Check if logged in
if ! flyctl auth whoami &> /dev/null; then
  echo "❌ Not logged in to Fly.io"
  echo "   Run: flyctl auth login"
  exit 1
fi

# Set secrets (shared across all regions)
echo "📝 Setting secrets..."
flyctl secrets set \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  DEEPGRAM_API_KEY="$DEEPGRAM_API_KEY" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  --app $APP_NAME

# Deploy to primary region (US)
echo ""
echo "🌎 Deploying to US region ($US_REGION)..."
flyctl deploy --app $APP_NAME --region $US_REGION

# Check if EU machine already exists
EU_MACHINE_EXISTS=$(flyctl machines list --app $APP_NAME --json 2>/dev/null | jq -r ".[] | select(.region == \"$EU_REGION\") | .id" | head -1)

if [ -z "$EU_MACHINE_EXISTS" ]; then
  echo ""
  echo "🌍 Creating machine in EU region ($EU_REGION)..."
  
  # Get first machine ID from US region
  US_MACHINE_ID=$(flyctl machines list --app $APP_NAME --json | jq -r ".[] | select(.region == \"$US_REGION\") | .id" | head -1)
  
  if [ -z "$US_MACHINE_ID" ]; then
    echo "❌ No US machine found. Deploy failed."
    exit 1
  fi
  
  # Clone machine to EU region
  flyctl machine clone $US_MACHINE_ID --region $EU_REGION --app $APP_NAME
else
  echo ""
  echo "✅ EU machine already exists in $EU_REGION, skipping clone"
fi

# Scale to ensure 1 machine per region
echo ""
echo "📊 Ensuring 1 machine per region..."
flyctl scale count 1 --app $APP_NAME --region $US_REGION
flyctl scale count 1 --app $APP_NAME --region $EU_REGION

# Health checks
echo ""
echo "🔍 Running health checks..."
sleep 5

APP_URL="https://${APP_NAME}.fly.dev"

echo "Checking health endpoint..."
if curl -f "$APP_URL/health" > /dev/null 2>&1; then
  echo "✅ Health check passed"
else
  echo "⚠️  Health check failed (deployment may still be in progress)"
fi

# Show machine status
echo ""
echo "📊 Machine Status:"
flyctl machines list --app $APP_NAME

echo ""
echo "✅ Multi-region deployment complete!"
echo ""
echo "📍 Voice V2 WebSocket URL:"
echo "   wss://${APP_NAME}.fly.dev"
echo ""
echo "🌍 Regions Active:"
echo "   - US: $US_REGION (Washington DC)"
echo "   - EU: $EU_REGION (Frankfurt)"
echo ""
echo "💡 Fly.io automatically routes users to nearest region!"
echo ""
echo "📊 View logs:"
echo "   flyctl logs --app $APP_NAME"
echo ""
echo "📈 View dashboard:"
echo "   flyctl dashboard --app $APP_NAME"

