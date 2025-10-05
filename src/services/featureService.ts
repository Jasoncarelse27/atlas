
import { toast } from "react-hot-toast"
import { useNavigate } from "react-router-dom"

// Map which features belong to which tiers
const tierFeatures: Record<string, string[]> = {
  free: [],
  core: ["image", "file", "audio"], // ✅ Core unlocks these
  studio: ["image", "file", "audio", "advanced-image", "advanced-audio"],
}

export function canUseFeature(tier: string, feature: string): boolean {
  console.log("[FeatureService] Checking feature:", feature, "for tier:", tier)

  // Default to false if tier unknown
  if (!tier) return false

  const allowed = tierFeatures[tier] || []
  return allowed.includes(feature)
}

export function useFeatureService() {
  const navigate = useNavigate()

  const checkFeature = (feature: "image" | "mic" | "file", tier: "free" | "core" | "studio") => {
    console.log(`🔍 checkFeature: feature=${feature}, tier=${tier}`)

    // Use the new canUseFeature logic
    const hasAccess = canUseFeature(tier, feature)
    
    if (!hasAccess) {
      // Determine which tier is needed
      const requiredTier = tierFeatures.core.includes(feature) ? "CORE" : "STUDIO"
      toast.error(`This feature requires ${requiredTier} tier. Upgrade to continue!`)
      navigate("/upgrade")
      return false
    }

    console.log(`✅ checkFeature: Access granted for ${feature} with ${tier} tier`)
    return true
  }

  const logFeatureAttempt = async (userId: string, feature: string, tier: string) => {
    try {
      // Use relative URL to leverage Vite proxy for mobile compatibility
      const response = await fetch('/api/feature-attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          feature,
          tier
        })
      });

      if (!response.ok) {
        console.error('Failed to log feature attempt:', response.statusText);
      } else {
        console.log(`Feature attempt logged: ${feature}, tier: ${tier}`);
      }
    } catch (err) {
      console.error('Error logging feature attempt:', err);
    }
  }

  return { 
    checkFeature, 
    logFeatureAttempt 
  }
}

// Legacy class-based service for backward compatibility
export class FeatureService {
  async logAttempt(
    userId: string, 
    feature: string, 
    tier: string
  ): Promise<void> {
    try {
      // Use relative URL to leverage Vite proxy for mobile compatibility
      const response = await fetch('/api/feature-attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          feature,
          tier
        })
      });

      if (!response.ok) {
        console.error('Failed to log feature attempt:', response.statusText);
      }
    } catch (err) {
      console.error('Error logging feature attempt:', err);
    }
  }
}

export const featureService = new FeatureService();