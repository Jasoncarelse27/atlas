
import { toast } from "react-hot-toast"
import { useNavigate } from "react-router-dom"
import { logger } from '../lib/logger';
import { getApiEndpoint } from '../utils/apiClient';

// Map which features belong to which tiers
const tierFeatures: Record<string, string[]> = {
  free: [],
  core: ["image", "file", "audio"], // ✅ Core unlocks these
  studio: ["image", "file", "audio", "advanced-image", "advanced-audio"],
}

export function canUseFeature(tier: string, feature: string): boolean {

  // Default to false if tier unknown
  if (!tier) return false

  const allowed = tierFeatures[tier] || []
  return allowed.includes(feature)
}

export function useFeatureService() {
  const navigate = useNavigate()

  const checkFeature = (feature: "image" | "mic" | "file", tier: "free" | "core" | "studio") => {

    // Use the new canUseFeature logic
    const hasAccess = canUseFeature(tier, feature)
    
    if (!hasAccess) {
      // Determine which tier is needed
      const requiredTier = tierFeatures.core.includes(feature) ? "CORE" : "STUDIO"
      toast.error(`This feature requires ${requiredTier} tier. Upgrade to continue!`)
      navigate("/upgrade")
      return false
    }

    logger.debug(`✅ checkFeature: Access granted for ${feature} with ${tier} tier`)
    return true
  }

  const logFeatureAttempt = async (userId: string, feature: string, tier: string) => {
    try {
      // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
      const response = await fetch(getApiEndpoint('/api/feature-attempts'), {
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
        // Feature flag log error is non-critical
      } else {
        // Feature flag logged successfully
      }
    } catch (err) {
      // Intentionally empty - error handling not required
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
      // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
      const response = await fetch(getApiEndpoint('/api/feature-attempts'), {
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
        // Feature attempt log error is non-critical
      }
    } catch (err) {
      // Intentionally empty - error handling not required
    }
  }
}

export const featureService = new FeatureService();