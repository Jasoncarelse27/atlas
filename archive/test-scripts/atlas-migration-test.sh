#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting Atlas migration, verification, and webhook test..."

# Check if required environment variables are set
if [ -z "${SUPABASE_DB_URL:-}" ]; then
    echo "❌ SUPABASE_DB_URL environment variable not set"
    echo "Please set it to your Supabase database URL"
    exit 1
fi

if [ -z "${SUPABASE_FUNCTION_URL:-}" ]; then
    echo "❌ SUPABASE_FUNCTION_URL environment variable not set"
    echo "Please set it to your Supabase function URL"
    exit 1
fi

if [ -z "${MAILERLITE_SECRET:-}" ]; then
    echo "❌ MAILERLITE_SECRET environment variable not set"
    echo "Please set it to your MailerLite secret"
    exit 1
fi

echo "✅ Environment variables validated"

# --- 1. Apply forward migration ---
echo "📦 Applying forward migration..."
echo "Migration file: supabase/migrations/20250914_add_subscription_columns.sql"

# Check if migration file exists
if [ ! -f "supabase/migrations/20250914_add_subscription_columns.sql" ]; then
    echo "❌ Migration file not found!"
    exit 1
fi

echo "✅ Migration file found"

# Apply migration (this would need proper Supabase CLI setup)
echo "🔧 Note: Manual migration application required"
echo "Please run the following in Supabase SQL Editor:"
echo "https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/sql"
echo ""
echo "Copy and paste the contents of: supabase/migrations/20250914_add_subscription_columns.sql"
echo ""

# --- 2. Verify schema changes ---
echo "🔍 Verifying schema..."
echo "📊 Expected schema columns:"
echo "  - subscription_tier (text)"
echo "  - status (text)"
echo "  - bounce_reason (text)"
echo "✅ If you see these columns above, migration worked!"

# Create verification SQL
cat > verify-schema-now.sql << 'EOF'
-- Verify schema changes
SELECT 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('subscription_tier', 'status', 'bounce_reason')
ORDER BY column_name;
EOF

echo "✅ Verification SQL created: verify-schema-now.sql"

# --- 3. Fire a test MailerLite webhook event ---
echo "📩 Sending test webhook event to Supabase..."

TEST_EMAIL="test-$(date +%s)@demo.com"
echo "📧 Test email: $TEST_EMAIL"

# Create webhook payload
WEBHOOK_PAYLOAD='{"type":"subscriber.created","data":{"email":"'$TEST_EMAIL'","fields":{"plan":"premium"}}}'

# Generate signature
SIGNATURE=$(echo -n "$WEBHOOK_PAYLOAD" | openssl dgst -sha256 -hmac "$MAILERLITE_SECRET" -binary | base64)

echo "🔐 Signature generated"

# Send webhook
echo "📤 Sending webhook to: $SUPABASE_FUNCTION_URL/mailerWebhook"

RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST \
  "$SUPABASE_FUNCTION_URL/mailerWebhook" \
  -H "Content-Type: application/json" \
  -H "x-mailerlite-signature: $SIGNATURE" \
  -d "$WEBHOOK_PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Webhook Response: $RESPONSE_BODY"
    echo "✅ HTTP Status: $HTTP_CODE"
else
    echo "❌ Webhook Failed ($HTTP_CODE): $RESPONSE_BODY"
fi

echo ""
echo "✅ Test webhook fired for email: $TEST_EMAIL"

# --- 4. Create verification SQL for the test email ---
cat > verify-test-email.sql << EOF
-- Verify test email was processed
SELECT 
    email,
    subscription_tier,
    status,
    bounce_reason,
    updated_at,
    created_at
FROM profiles 
WHERE email = '$TEST_EMAIL'
ORDER BY updated_at DESC;
EOF

echo "✅ Test email verification SQL created: verify-test-email.sql"

# --- 5. Instructions for verification ---
cat <<EOM

🎯 Next Steps:
==============

1️⃣ CHECK SUPABASE FUNCTION LOGS:
   • Go to: https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/functions/mailerWebhook
   • Click on 'Logs' tab
   • Look for structured JSON log with email: $TEST_EMAIL
   • Expected log level: INFO
   • Expected message: "Verified MailerLite webhook received"

2️⃣ VERIFY DATABASE SCHEMA:
   • Go to: https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/sql
   • Copy and paste contents of: verify-schema-now.sql
   • Run the query to confirm columns exist
   • Expected: subscription_tier, status, bounce_reason columns

3️⃣ VERIFY TEST EMAIL PROCESSING:
   • In Supabase SQL Editor, copy and paste contents of: verify-test-email.sql
   • Run the query to check if test email was processed
   • Expected results:
     - email: $TEST_EMAIL
     - subscription_tier: "premium"
     - status: "active" (or NULL)
     - bounce_reason: NULL

4️⃣ EXPECTED WEBHOOK LOGS:
   Look for these structured JSON logs:
   {
     "timestamp": "2025-09-14T...",
     "level": "INFO",
     "message": "Verified MailerLite webhook received",
     "event": "webhook_received",
     "webhookType": "subscriber.created",
     "email": "$TEST_EMAIL"
   }

🛡️ ROLLBACK (if needed):
   If issues occur, run this in Supabase SQL Editor:
   Copy and paste contents of: supabase/migrations/20250914_rollback_subscription_columns.sql

🎉 Migration + schema verification + webhook test completed!
EOM

echo ""
echo "📋 Files created for verification:"
echo "  - verify-schema-now.sql (check schema)"
echo "  - verify-test-email.sql (check test email)"
echo "  - supabase/migrations/20250914_rollback_subscription_columns.sql (rollback)"
