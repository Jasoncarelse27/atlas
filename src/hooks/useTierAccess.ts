import { getClaudeModelName, tierFeatures } from "@/config/featureAccess"
import { supabase } from "@/lib/supabaseClient"
import { useEffect, useState } from "react"

type Tier = "free" | "core" | "studio"

export function useTierAccess() {
  const [tier, setTier] = useState<Tier>("free")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTier = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.log("[useTierAccess] No user found, defaulting to free")
          setLoading(false)
          return
        }

        console.log("[useTierAccess] Fetching tier for user:", user.id)

        const { data, error } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("id", user.id)
          .single()

        if (!error && data?.subscription_tier) {
          setTier(data.subscription_tier as Tier)
          console.log("[useTierAccess] Fetched tier:", data.subscription_tier)
        } else {
          console.log("[useTierAccess] No profile found or error:", error)
        }
      } catch (err) {
        console.error("[useTierAccess] Error:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchTier()
  }, [])

  const hasAccess = (feature: "file" | "image" | "camera" | "audio") => {
    // Don't allow access while still loading tier information
    if (loading) return false
    
    if (tier === "studio") return true
    if (tier === "core") return feature === "image" || feature === "audio"
    return false
  }

  const showUpgradeModal = (feature: string) => {
    console.log(`⚠️ Upgrade required for: ${feature}`);
    // Note: Upgrade modal handled by useSubscription hook
  }

  return { tier, hasAccess, loading, showUpgradeModal }
}

// Feature access hook for specific features
export function useFeatureAccess(feature: "audio" | "image" | "camera" | "voice") {
  const { tier, loading } = useTierAccess()
  
  const canUse = () => {
    if (loading) return false
    
    switch (feature) {
      case "audio":
        return tier === "core" || tier === "studio"
      case "image":
        return tier === "core" || tier === "studio"
      case "camera":
        return tier === "studio"
      case "voice":
        return tier === "core" || tier === "studio"
      default:
        return false
    }
  }

  const attemptFeature = async () => {
    if (canUse()) {
      return true
    }
    
    // Log feature attempt for analytics
    try {
      await supabase
        .from('feature_attempts')
        .insert({
          feature,
          tier,
          attempted_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Failed to log feature attempt:', error)
    }
    
    return false
  }

  return {
    canUse: canUse(),
    attemptFeature,
    tier,
    loading
  }
}

// Message limit hook
export function useMessageLimit() {
  const { tier, loading } = useTierAccess()
  
  const getLimit = (feature: "textMessages" | "audioMinutes" | "imageUploads") => {
    if (loading) return 0
    
    const tierConfig = tierFeatures[tier]
    
    switch (feature) {
      case "textMessages":
        // Free tier has maxConversationsPerMonth, others have maxConversationsPerDay
        if (tier === 'free') {
          return (tierConfig as any).maxConversationsPerMonth || 15
        }
        return (tierConfig as any).maxConversationsPerDay || 150
      case "audioMinutes":
        return tierConfig.audio ? 60 : 0
      case "imageUploads":
        return tierConfig.image ? 10 : 0
      default:
        return 0
    }
  }

  const isUnlimited = (feature: "textMessages" | "audioMinutes" | "imageUploads") => {
    if (loading) return false
    
    const limit = getLimit(feature)
    return limit === -1
  }

  const claudeModelName = getClaudeModelName(tier)

  return {
    tier,
    loading,
    getLimit,
    isUnlimited,
    claudeModelName
  }
}