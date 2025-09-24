// Test harness for FastSpring webhook integration
// Run with: deno run --allow-net --allow-env scripts/test-fastspring-webhook.ts

const WEBHOOK_URL = "http://localhost:54321/functions/v1/fastspring-webhook";
const TEST_USER_ID = "65fcb50a-d67d-453e-a405-50c6aef959be"; // Replace with real user UUID from profiles

interface WebhookPayload {
  eventType: string;
  accountId: string;
  oldTier?: string;
  newTier: string;
}

async function testWebhook(payload: WebhookPayload) {
  console.log(`🧪 Testing webhook: ${payload.eventType}`);
  
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    
    if (res.ok) {
      console.log("✅ Success:", result);
    } else {
      console.log("❌ Error:", result);
    }
    
    return result;
  } catch (error) {
    console.error("❌ Network error:", error);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log("🚀 FastSpring Webhook Test Harness");
  console.log("=====================================");
  
  const tests = [
    {
      name: "Subscription Activation",
      payload: {
        eventType: "subscription.activated",
        accountId: TEST_USER_ID,
        newTier: "core"
      }
    },
    {
      name: "Trial Conversion",
      payload: {
        eventType: "subscription.trial.converted",
        accountId: TEST_USER_ID,
        newTier: "studio"
      }
    },
    {
      name: "Subscription Upgrade",
      payload: {
        eventType: "subscription.updated",
        accountId: TEST_USER_ID,
        oldTier: "core",
        newTier: "studio"
      }
    },
    {
      name: "Subscription Downgrade",
      payload: {
        eventType: "subscription.updated",
        accountId: TEST_USER_ID,
        oldTier: "studio",
        newTier: "core"
      }
    },
    {
      name: "Subscription Cancellation",
      payload: {
        eventType: "subscription.canceled",
        accountId: TEST_USER_ID,
        newTier: "free"
      }
    }
  ];

  for (const test of tests) {
    console.log(`\n📋 ${test.name}`);
    await testWebhook(test.payload);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests
  }
  
  console.log("\n🎯 All tests completed!");
  console.log("Check the subscription_audit table and profiles table for changes.");
}

// Run the tests
runTests().catch(console.error);
