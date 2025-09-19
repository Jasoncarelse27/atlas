#!/usr/bin/env bash
set -euo pipefail

# Default URL is local backend, can override with arg
API_URL=${1:-http://localhost:3000}

# Optional JWT for authenticated tests
JWT=${SUPABASE_JWT:-""}

echo "🔎 Testing Atlas Backend at $API_URL ..."

echo ""
echo "1️⃣ Health Check"
curl -s -i "$API_URL/healthz"

echo ""
echo "2️⃣ Message Endpoint (anonymous, expect 401)"
curl -s -i -X POST "$API_URL/message" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'

if [[ -n "$JWT" ]]; then
  echo ""
  echo "3️⃣ Message Endpoint (authenticated, expect 200 or 429 if limits hit)"
  curl -s -i -X POST "$API_URL/message" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT" \
    -d '{"message": "Hello from sanity test!"}'
else
  echo ""
  echo "⚠️ No SUPABASE_JWT provided, skipping authenticated test"
  echo "   → Run with: SUPABASE_JWT=<your_token> ./sanity-backend.sh"
fi

echo ""
echo "✅ Sanity checks complete."
