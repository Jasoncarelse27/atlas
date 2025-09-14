#!/usr/bin/env node

/**
 * Test script for CI/CD alert functionality
 * This simulates the alert system without requiring Supabase local environment
 */

const testAlertData = {
  stage: "Test Deployment",
  status: "success",
  details: `This is a test alert from the Atlas CI/CD system.

Workflow: Test Deployment
Status: success
Branch: main
Commit: abc123def456
Message: test: add CI/CD alert system
Duration: 2m 30s
URL: https://github.com/Jasoncarelse27/atlas/actions/runs/123456

Triggered by: jasoncarelse
Repository: Jasoncarelse27/atlas
Event: workflow_run`,
  signingSecret: "test-secret"
};

console.log("🧪 Testing CI/CD Alert System");
console.log("================================");
console.log("");

console.log("📧 Email Content Preview:");
console.log("Subject:", `[Atlas Alert] ${testAlertData.stage} - ${testAlertData.status.toUpperCase()}`);
console.log("");

console.log("📋 Alert Details:");
console.log("Stage:", testAlertData.stage);
console.log("Status:", testAlertData.status);
console.log("Details:", testAlertData.details);
console.log("");

console.log("✅ Test data prepared successfully!");
console.log("");
console.log("📝 Next steps:");
console.log("1. Deploy the cicd-alert function to Supabase");
console.log("2. Set up environment variables in Supabase:");
console.log("   - MAILERLITE_API_KEY");
console.log("   - MAILERLITE_SIGNING_SECRET");
console.log("3. Test with real deployment");
console.log("");

console.log("🔧 To deploy the function:");
console.log("supabase functions deploy cicd-alert");
console.log("");

console.log("🧪 To test the deployed function:");
console.log(`curl -X POST "https://your-project.supabase.co/functions/v1/cicd-alert" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \\
  -d '${JSON.stringify(testAlertData, null, 2)}'`);
