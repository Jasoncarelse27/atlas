// 🎯 ATLAS GOLDEN STANDARD - Centralized Tier Access Hook
// This is the SINGLE SOURCE OF TRUTH for all tier checks
// ✅ ALWAYS import and use this hook - NEVER hardcode tier checks

import { getClaudeModelName, isValidTier, tierFeatures } from "@/config/featureAccess"
import { supabase } from "@/lib/supabaseClient"
import { subscriptionApi } from "@/services/subscriptionApi"
import { useCallback, useEffect, useState } from "react"

type Tier = "free" | "core" | "studio"

interface TierAccessState {
  tier: Tier
  loading: boolean
  userId: string | null
}

// ✅ CENTRALIZED TIER ACCESS HOOK
export function useTierAccess() {
  const [state, setState] = useState<TierAccessState>({
    tier: "free",
    loading: true,
    userId: null
  })

  const fetchTier = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setState({ tier: "free", loading: false, userId: null })
        return
      }

      const session = await supabase.auth.getSession()
      const accessToken = session.data.session?.access_token

      if (!accessToken) {
        setState({ tier: "free", loading: false, userId: user.id })
        return
      }

      // ✅ Use centralized subscription API
      const tier = await subscriptionApi.getUserTier(user.id, accessToken)
      
      // Validate tier
      const validTier = isValidTier(tier) ? tier : "free"
      
      setState({ tier: validTier, loading: false, userId: user.id })
    } catch (err) {
      console.error("[useTierAccess] Error:", err)
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [])

  useEffect(() => {
    fetchTier()

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchTier()
    })

    return () => subscription.unsubscribe()
  }, [fetchTier])

  // ✅ Feature access based on tier config (NO hardcoded checks!)
  const hasAccess = useCallback((feature: "file" | "image" | "camera" | "audio") => {
    if (state.loading) return false
    
    const config = tierFeatures[state.tier]
    
    // Map feature names to config keys
    const featureMap = {
      file: 'text',
      image: 'image',
      camera: 'camera',
      audio: 'audio'
    } as const
    
    return config[featureMap[feature]] || false
  }, [state.tier, state.loading])

  // ✅ Show upgrade modal (to be implemented by consuming component)
  const showUpgradeModal = useCallback((feature: string) => {
    console.log(`⚠️ Upgrade required for: ${feature}`)
    // Note: Modal display handled by UpgradeModal component
  }, [])

  // ✅ Claude model name from config
  const claudeModelName = getClaudeModelName(state.tier)

  return { 
    tier: state.tier,
    userId: state.userId,
    hasAccess, 
    loading: state.loading, 
    showUpgradeModal,
    claudeModelName,
    refresh: fetchTier
  }
}

// ✅ FEATURE ACCESS HOOK - For specific feature checks
export function useFeatureAccess(feature: "audio" | "image" | "camera" | "voice") {
  const { tier, loading, userId } = useTierAccess()
  
  // ✅ Use tier config instead of hardcoded checks
  const canUse = useCallback(() => {
    if (loading) return false
    
    const config = tierFeatures[tier]
    
    // Map feature names
    switch (feature) {
      case "audio":
      case "voice":
        return config.audio
      case "image":
        return config.image
      case "camera":
        return config.camera
      default:
        return false
    }
  }, [tier, loading, feature])

  // ✅ Log feature attempt for analytics
  const attemptFeature = useCallback(async () => {
    const allowed = canUse()
    
    if (!allowed && userId) {
      try {
        await supabase
          .from('feature_attempts')
          .insert({
            user_id: userId,
            feature,
            tier,
            attempted_at: new Date().toISOString()
          })
      } catch (error) {
        // Silent fail - analytics shouldn't block user
        console.error('Failed to log feature attempt:', error)
      }
    }
    
    return allowed
  }, [canUse, userId, feature, tier])

  return {
    canUse: canUse(),
    attemptFeature,
    tier,
    loading
  }
}

// ✅ MESSAGE LIMIT HOOK - For message/usage limits
export function useMessageLimit() {
  const { tier, loading } = useTierAccess()
  
  // ✅ Get limits from tier config (NO hardcoded checks!)
  const getLimit = useCallback((feature: "textMessages" | "audioMinutes" | "imageUploads") => {
    if (loading) return 0
    
    const config = tierFeatures[tier]
    
    switch (feature) {
      case "textMessages":
        // Use config values directly
        return (config as any).maxConversationsPerMonth || (config as any).maxConversationsPerDay || 0
      case "audioMinutes":
        return config.audio ? 60 : 0
      case "imageUploads":
        return config.image ? 10 : 0
      default:
        return 0
    }
  }, [tier, loading])

  const isUnlimited = useCallback((feature: "textMessages" | "audioMinutes" | "imageUploads") => {
    const limit = getLimit(feature)
    return limit === -1
  }, [getLimit])

  const claudeModelName = getClaudeModelName(tier)

  return {
    tier,
    loading,
    getLimit,
    isUnlimited,
    claudeModelName
  }
}
