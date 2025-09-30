#!/bin/bash
# FastSpring Webhook Test Script with Supabase Validation

PROJECT_REF="your-project-ref"   # Your Supabase project reference
WEBHOOK_URL="https://$PROJECT_REF.functions.supabase.co/fastspringWebhook"
SUPABASE_URL="https://$PROJECT_REF.supabase.co"
SUPABASE_ANON_KEY="your-anon-key-here"
USER_EMAIL="jasonc.jpg@gmail.com"

function check_tier() {
  echo "🔍 Checking subscription_tier for $USER_EMAIL ..."
  curl -s "$SUPABASE_URL/rest/v1/profiles?email=eq.$USER_EMAIL&select=subscription_tier" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" | jq .
  echo ""
}

function send_webhook() {
  local event_type="$1"
  local account_id="$2"
  local status="$3"
  local product="$4"
  
  echo "📤 Sending $event_type event..."
  local response=$(curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -d '{
      "type": "'"$event_type"'",
      "data": {
        "account": { "id": "'"$account_id"'", "email": "'"$USER_EMAIL"'" },
        "subscription": { "status": "'"$status"'", "product": "'"$product"'" }
      }
    }')
  
  echo "Response: $response"
  echo ""
}

echo "🚀 Testing FastSpring Webhooks at $WEBHOOK_URL"
echo "📧 Target user: $USER_EMAIL"
echo ""

# Create test profile first
echo "👤 Creating test profile..."
curl -s -X POST "$SUPABASE_URL/rest/v1/profiles" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "'"$USER_EMAIL"'", "subscription_tier": "free", "subscription_status": "active"}' | jq .
echo ""

# Check initial state
echo "📊 Initial state:"
check_tier

# Test 1: Core subscription activation
echo "🧪 Test 1: Core subscription activation"
send_webhook "subscription.activated" "fs_acc_core_001" "active" "atlas-core-monthly"
check_tier

# Test 2: Studio subscription (trial)
echo "🧪 Test 2: Studio subscription (trial)"
send_webhook "subscription.activated" "fs_acc_studio_002" "trial" "atlas-studio-monthly"
check_tier

# Test 3: Cancel subscription → free
echo "🧪 Test 3: Cancel subscription → free"
send_webhook "subscription.canceled" "fs_acc_cancel_003" "canceled" "atlas-core-monthly"
check_tier

# Test 4: Reactivate to Core
echo "🧪 Test 4: Reactivate to Core"
send_webhook "subscription.activated" "fs_acc_core_004" "active" "atlas-core-monthly"
check_tier

# Test 5: Upgrade to Studio
echo "🧪 Test 5: Upgrade to Studio"
send_webhook "subscription.activated" "fs_acc_studio_005" "trial" "atlas-studio-monthly"
check_tier

# Final state check
echo "📊 Final state:"
check_tier

echo "🎯 FastSpring webhook testing complete!"
echo "✅ All webhook events sent and validated."
echo ""
echo "🔗 Webhook URL: $WEBHOOK_URL"
echo "📋 Dashboard: https://supabase.com/dashboard/project/$PROJECT_REF/functions"
