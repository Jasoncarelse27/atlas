// Atlas Tier System QA Test
// Simple JavaScript version for quick validation

const tierConfig = {
  free: {
    text: true,
    audio: false,
    image: false,
    camera: false,
  },
  core: {
    text: true,
    audio: true,
    image: true,
    camera: false,
  },
  studio: {
    text: true,
    audio: true,
    image: true,
    camera: true,
  },
};

function getModelForTier(tier) {
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

function checkFeatureAccess(feature, tier) {
  // Check if the feature is allowed for this tier
  if (tierConfig[tier]?.[feature]) {
    return { allowed: true, message: null };
  }

  // Generate appropriate upgrade message based on tier and feature
  if (tier === 'free') {
    if (feature === 'camera') {
      return {
        allowed: false,
        message: 'Camera features require Atlas Studio (Claude Opus – $189.99/mo). Upgrade to unlock the full experience.',
        suggestedTier: 'studio'
      };
    }
    return {
      allowed: false,
      message: 'This feature requires Atlas Core (Claude Sonnet – $19.99/mo). Upgrade to unlock audio and image features.',
      suggestedTier: 'core'
    };
  }

  if (tier === 'core' && feature === 'camera') {
    return {
      allowed: false,
      message: 'Camera features are exclusive to Atlas Studio (Claude Opus – $189.99/mo). Upgrade to unlock.',
      suggestedTier: 'studio'
    };
  }

  // Default case - should not happen with proper tier config
  return {
    allowed: false,
    message: 'This feature requires an upgrade.',
    suggestedTier: 'core'
  };
}

function getUpgradeMessage(feature, tier) {
  const result = checkFeatureAccess(feature, tier);
  return result.allowed ? null : result.message;
}

function runQATests() {
  console.log("🧪 Atlas Tier System QA Test\n");

  const tiers = ["free", "core", "studio"];
  const features = ["text", "audio", "image", "camera"];

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
