#!/usr/bin/env bash
set -euo pipefail

echo "🧪 Local Webhook Test Script"
echo "============================="
echo
echo "This script tests the webhook with environment variables."
echo "Make sure to set the following environment variables:"
echo "  export ANON_KEY=\"your-supabase-anon-key\""
echo "  export MAILERLITE_SIGNING_SECRET=\"your-mailerlite-secret\""
echo

# Check if environment variables are set
if [ -z "${ANON_KEY:-}" ]; then
  echo "❌ ANON_KEY environment variable is not set"
  echo "   Get it with: supabase projects api-keys --project-ref rbwabemtucdkytvvpzvk"
  exit 1
fi

if [ -z "${MAILERLITE_SIGNING_SECRET:-}" ]; then
  echo "❌ MAILERLITE_SIGNING_SECRET environment variable is not set"
  echo "   Set it to your actual MailerLite signing secret"
  exit 1
fi

echo "✅ Environment variables are set"
echo "   ANON_KEY: ${ANON_KEY:0:20}..."
echo "   MAILERLITE_SIGNING_SECRET: ${MAILERLITE_SIGNING_SECRET:0:10}..."
echo

# Run the main test script
echo "🚀 Running webhook tests..."
./test_mailerlite_webhook_final.sh
