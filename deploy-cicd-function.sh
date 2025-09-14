#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="rbwabemtucdkytvvpzvk"
FUNCTIONS=("cicd-alert" "mailerWebhook")

echo "🔍 Checking Supabase project ref..."
echo "Using project: $PROJECT_REF"

for FUNCTION_NAME in "${FUNCTIONS[@]}"; do
  echo "🚀 Deploying Edge Function: $FUNCTION_NAME..."
  supabase functions deploy $FUNCTION_NAME --project-ref $PROJECT_REF --no-verify-jwt
  
  echo "⏳ Waiting a few seconds for deployment to propagate..."
  sleep 5
  
  FUNCTION_URL="https://${PROJECT_REF}.supabase.co/functions/v1/${FUNCTION_NAME}"
  
  echo "🌐 Testing function endpoint: $FUNCTION_URL"
  if [ "$FUNCTION_NAME" = "cicd-alert" ]; then
    curl -i -X POST "$FUNCTION_URL" \
      -H "Content-Type: application/json" \
      -d '{"message":"Test from local deployment script"}'
  else
    curl -i -X POST "$FUNCTION_URL" \
      -H "Content-Type: application/json" \
      -d '{"type":"test","data":{"email":"test@example.com"}}'
  fi
  
  echo "✅ $FUNCTION_NAME deployed and tested!"
  echo ""
done

echo "🎉 All functions deployed successfully!"
