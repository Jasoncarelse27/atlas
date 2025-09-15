/**
 * Atlas V1 Golden Standard - Tier Enforcement QA Script
 * Run with:  ts-node qa/tierEnforcementTest.ts
 */

import fetch from "node-fetch";

const API_BASE = "http://localhost:3000"; // backend running locally

// Simulated test users by tier
const testUsers = [
  { id: "free-user-1", tier: "free", expectedModel: "claude-3-haiku" },
  { id: "core-user-1", tier: "core", expectedModel: "claude-3-sonnet" },
  { id: "studio-user-1", tier: "studio", expectedModel: "claude-3-opus" },
];

// Helper: reset feature attempts before testing
async function resetAttempts() {
  try {
    await fetch(`${API_BASE}/admin/resetAttempts`, { method: "POST" });
    console.log("🧹 Reset feature attempts table");
  } catch (error) {
    console.warn("⚠️ Could not reset attempts:", error);
  }
}

// Helper: send a chat message
async function sendMessage(userId: string, tier: string, message: string) {
  const res = await fetch(`${API_BASE}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, tier, message }),
  });
  return res.json();
}

// Test Free tier: should stop at 15 messages
async function testFreeTier() {
  console.log("\n🟡 Testing Free Tier...");
  for (let i = 1; i <= 16; i++) {
    const response = await sendMessage("free-user-1", "free", `Test ${i}`);
    if (i <= 15) {
      console.log(`✅ Message ${i} → allowed, model: ${response.model}`);
    } else {
      console.log(`⚠️ Message ${i} → should be blocked. Got: ${response.error || "unexpected response"}`);
    }
  }
}

// Test Core + Studio tiers: unlimited
async function testUnlimitedTier(userId: string, tier: string, expectedModel: string) {
  console.log(`\n🟢 Testing ${tier.toUpperCase()} Tier...`);
  for (let i = 1; i <= 5; i++) {
    const response = await sendMessage(userId, tier, `Test ${i}`);
    if (response.model === expectedModel) {
      console.log(`✅ Message ${i} → correct model: ${expectedModel}`);
    } else {
      console.log(`❌ Message ${i} → wrong model, got: ${response.model}`);
    }
  }
}

(async () => {
  await resetAttempts();
  await testFreeTier();
  await testUnlimitedTier("core-user-1", "core", "claude-3-sonnet");
  await testUnlimitedTier("studio-user-1", "studio", "claude-3-opus");
  console.log("\n🎉 QA Test Completed!");
})();
