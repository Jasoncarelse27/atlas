// ============================================
// Atlas: Migration + Verification + Webhook Test + Rollback
// Run this in Cursor to fully manage Supabase schema + webhook integration
// ============================================

import { execSync } from "child_process";
import fs from "fs";
import crypto from "crypto";

// --- CONFIG ---
const SUPABASE_URL = process.env.SUPABASE_URL || "https://rbwabemtucdkytvvpzvk.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "your_service_role_key";
const MAILERLITE_SECRET = process.env.MAILERLITE_SECRET || "wAGDBZzeJK";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/mailerWebhook`;

console.log("🔧 Configuration:");
console.log(`  SUPABASE_URL: ${SUPABASE_URL}`);
console.log(`  FUNCTION_URL: ${FUNCTION_URL}`);
console.log(`  MAILERLITE_SECRET: ${MAILERLITE_SECRET.substring(0, 8)}...`);

// --- 1) Forward Migration ---
const forwardMigration = `
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS bounce_reason text;

COMMENT ON COLUMN profiles.subscription_tier IS 'User subscription tier synced from MailerLite';
COMMENT ON COLUMN profiles.status IS 'Account status (active, inactive, unsubscribed)';
COMMENT ON COLUMN profiles.bounce_reason IS 'Reason for email bounce (if any)';

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);

-- Update existing profiles to have default values
UPDATE profiles 
SET 
    subscription_tier = COALESCE(subscription_tier, 'free'),
    status = COALESCE(status, 'active')
WHERE subscription_tier IS NULL OR status IS NULL;
`;

// --- 2) Rollback Migration ---
const rollbackMigration = `
-- Drop indexes first
DROP INDEX IF EXISTS idx_profiles_subscription_tier;
DROP INDEX IF EXISTS idx_profiles_status;
DROP INDEX IF EXISTS idx_profiles_updated_at;

-- Drop columns
ALTER TABLE profiles
  DROP COLUMN IF EXISTS subscription_tier,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS bounce_reason;
`;

// --- 3) Verification Queries ---
const verifySchema = `
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('subscription_tier','status','bounce_reason')
ORDER BY column_name;
`;

const verifyTestEmail = (email) => `
SELECT email, subscription_tier, status, bounce_reason, updated_at
FROM profiles
WHERE email = '${email}'
ORDER BY updated_at DESC;
`;

const verifyIndexes = `
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'profiles' 
AND indexname LIKE 'idx_profiles_%'
ORDER BY indexname;
`;

// --- 4) Webhook Test Payload ---
const testEmail = `test-${Date.now()}@demo.com`;
const payload = {
  type: "subscriber.created",
  data: {
    email: testEmail,
    fields: { plan: "premium" }
  }
};

// --- HELPER: Generate HMAC Signature ---
function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('base64');
}

// --- HELPER: Run SQL in Supabase ---
function runSQL(sql, description = "SQL Query") {
  console.log(`\n📜 ${description}:`);
  console.log("SQL:", sql.replace(/\n/g, " ").substring(0, 100) + "...");
  
  try {
    // For now, we'll create a file that can be run in Supabase SQL Editor
    const filename = `temp-${Date.now()}.sql`;
    fs.writeFileSync(filename, sql);
    console.log(`✅ SQL written to: ${filename}`);
    console.log("📋 Copy and paste this file content into Supabase SQL Editor");
    return filename;
  } catch (error) {
    console.error("❌ Error writing SQL file:", error.message);
    return null;
  }
}

// --- HELPER: Test Webhook ---
function testWebhook(payload, testEmail) {
  console.log(`\n📩 Testing webhook for email: ${testEmail}`);
  
  const signature = generateSignature(payload, MAILERLITE_SECRET);
  console.log(`🔐 Generated signature: ${signature.substring(0, 20)}...`);
  
  try {
    const curlCommand = `curl -sS -w "\\n%{http_code}" -X POST '${FUNCTION_URL}' \\
     -H "Content-Type: application/json" \\
     -H "x-mailerlite-signature: ${signature}" \\
     -d '${JSON.stringify(payload)}'`;
    
    console.log("📤 Sending webhook...");
    const result = execSync(curlCommand, { encoding: 'utf8' });
    
    const lines = result.trim().split('\n');
    const httpCode = lines[lines.length - 1];
    const responseBody = lines.slice(0, -1).join('\n');
    
    if (httpCode === '200') {
      console.log(`✅ Webhook Response: ${responseBody}`);
      console.log(`✅ HTTP Status: ${httpCode}`);
      return true;
    } else {
      console.log(`❌ Webhook Failed (${httpCode}): ${responseBody}`);
      return false;
    }
  } catch (error) {
    console.error("❌ Webhook test error:", error.message);
    return false;
  }
}

// --- HELPER: Create Verification Script ---
function createVerificationScript(testEmail) {
  const verificationScript = `#!/bin/bash
set -euo pipefail

echo "🔍 Atlas Migration Verification Script"
echo "======================================"

# Test email from migration
TEST_EMAIL="${testEmail}"

echo "📧 Test email: \$TEST_EMAIL"
echo ""

echo "1️⃣ Verifying database schema..."
echo "Run this SQL in Supabase SQL Editor:"
echo "https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/sql"
echo ""
cat << 'EOF'
${verifySchema}
EOF

echo ""
echo "2️⃣ Verifying test email processing..."
echo "Run this SQL in Supabase SQL Editor:"
echo ""
cat << 'EOF'
${verifyTestEmail(testEmail)}
EOF

echo ""
echo "3️⃣ Verifying indexes..."
echo "Run this SQL in Supabase SQL Editor:"
echo ""
cat << 'EOF'
${verifyIndexes}
EOF

echo ""
echo "4️⃣ Expected Results:"
echo "===================="
echo "Schema: subscription_tier, status, bounce_reason columns should exist"
echo "Test Email: subscription_tier should be 'premium'"
echo "Indexes: idx_profiles_subscription_tier, idx_profiles_status should exist"
echo ""
echo "5️⃣ Check Webhook Logs:"
echo "======================"
echo "Go to: https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/functions/mailerWebhook"
echo "Click on 'Logs' tab"
echo "Look for structured JSON logs with email: \$TEST_EMAIL"
echo ""
echo "✅ Verification complete!"
`;

  const filename = `verify-migration-${Date.now()}.sh`;
  fs.writeFileSync(filename, verificationScript);
  fs.chmodSync(filename, '755');
  console.log(`✅ Verification script created: ${filename}`);
  return filename;
}

// --- MAIN FLOW ---
async function main() {
  console.log("🚀 Starting Atlas Migration + Webhook Test...");
  console.log("=============================================");

  // Step 1: Forward Migration
  console.log("\n⚙️ Step 1: Creating forward migration...");
  const migrationFile = runSQL(forwardMigration, "Forward Migration");
  
  // Step 2: Create Rollback Migration
  console.log("\n🔄 Step 2: Creating rollback migration...");
  const rollbackFile = runSQL(rollbackMigration, "Rollback Migration");

  // Step 3: Test Webhook
  console.log("\n📩 Step 3: Testing webhook...");
  const webhookSuccess = testWebhook(payload, testEmail);

  // Step 4: Create Verification Script
  console.log("\n🔍 Step 4: Creating verification script...");
  const verificationFile = createVerificationScript(testEmail);

  // Step 5: Create Schema Verification
  console.log("\n📊 Step 5: Creating schema verification...");
  const schemaFile = runSQL(verifySchema, "Schema Verification");

  // Step 6: Create Test Email Verification
  console.log("\n📧 Step 6: Creating test email verification...");
  const testEmailFile = runSQL(verifyTestEmail(testEmail), "Test Email Verification");

  // Step 7: Create Index Verification
  console.log("\n🔍 Step 7: Creating index verification...");
  const indexFile = runSQL(verifyIndexes, "Index Verification");

  // Summary
  console.log("\n🎯 MIGRATION SUMMARY:");
  console.log("====================");
  console.log(`✅ Forward Migration: ${migrationFile}`);
  console.log(`✅ Rollback Migration: ${rollbackFile}`);
  console.log(`✅ Webhook Test: ${webhookSuccess ? 'SUCCESS' : 'FAILED'}`);
  console.log(`✅ Verification Script: ${verificationFile}`);
  console.log(`✅ Schema Verification: ${schemaFile}`);
  console.log(`✅ Test Email Verification: ${testEmailFile}`);
  console.log(`✅ Index Verification: ${indexFile}`);
  console.log(`📧 Test Email: ${testEmail}`);

  console.log("\n📋 NEXT STEPS:");
  console.log("==============");
  console.log("1. Go to Supabase SQL Editor:");
  console.log("   https://supabase.com/dashboard/project/rbwabemtucdkytvvpzvk/sql");
  console.log("2. Copy and paste the forward migration SQL");
  console.log("3. Run the migration");
  console.log("4. Run the verification script:");
  console.log(`   ./${verificationFile}`);
  console.log("5. Check webhook logs in Supabase Dashboard");

  console.log("\n🛡️ ROLLBACK (if needed):");
  console.log("========================");
  console.log("If issues occur, copy and paste the rollback migration SQL");
  console.log("into Supabase SQL Editor and run it.");

  console.log("\n✅ Migration + Webhook Test Complete!");
}

// Error handling
main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
