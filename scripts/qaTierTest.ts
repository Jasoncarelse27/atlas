import { checkFeatureAccess, getUpgradeMessage } from "../src/config/tierAccess.js";

type Tier = "free" | "core" | "studio";
type Feature = "text" | "audio" | "image" | "camera";

const tiers: Tier[] = ["free", "core", "studio"];
const features: Feature[] = ["text", "audio", "image", "camera"];

function getModelForTier(tier: Tier): string {
  switch (tier) {
    case "free":
      return "claude-3-haiku-20240307";
    case "core":
      return "claude-3.5-sonnet-20240620";
    case "studio":
      return "claude-3-opus-20240229";
    default:
      return "unknown";
  }
}

function runQATests() {
  console.log("🧪 Atlas Tier System QA Test\n");

  for (const tier of tiers) {
    console.log(`\n===== 👤 Tier: ${tier.toUpperCase()} (Model: ${getModelForTier(tier)}) =====`);

    for (const feature of features) {
      const result = checkFeatureAccess(feature, tier);
      const message = getUpgradeMessage(feature, tier);

      console.log(
        `Feature: ${feature.padEnd(6)} → ${result.allowed ? "✅ Allowed" : "❌ Blocked"}`
      );
      if (message) {
        console.log(`   ↳ Modal: "${message}"`);
      }
    }
  }

  console.log("\n🎯 Expected Results:");
  console.log("• Free: text ✅, audio/image/camera ❌");
  console.log("• Core: text/audio/image ✅, camera ❌");
  console.log("• Studio: all features ✅");
  console.log("\n✅ QA Test Complete!");
}

runQATests();
