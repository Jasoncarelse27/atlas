import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useSubscription } from "./useSubscription"

export function useTierAccess(userId?: string) {
  const { profile, loading, forceRefresh } = useSubscription(userId)
  const queryClient = useQueryClient()
  
  // Usage tracking state - MUST be called before any conditional returns
  const [messageCount, setMessageCount] = useState(0)
  const [maxMessages, setMaxMessages] = useState(15)
  const [remainingMessages, setRemainingMessages] = useState(15)
  
  // Fetch usage from backend
  const fetchUsage = useCallback(async () => {
    if (!userId || loading) return
    
    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession()
      let token = session?.access_token
      
      // Use mock token for development if no real token
      if (!token && import.meta.env.DEV) {
        token = 'mock-token-for-development'
        console.log('🔓 Using mock token for development')
      }
      
      if (!token) {
        console.warn('No access token available for usage fetch')
        return
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/usage/${userId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      })
      
      if (response.ok) {
        const usage = await response.json()
        setMessageCount(usage.conversations_count || 0)
      } else if (response.status === 401) {
        console.warn('Unauthorized access to usage endpoint - token may be expired')
      }
    } catch (error) {
      console.warn('Failed to fetch usage:', error)
    }
  }, [userId])

  // Set limits based on tier
  useEffect(() => {
    if (!profile) return
    
    const tier = profile.subscription_tier || "free"
    switch (tier) {
      case 'free':
        setMaxMessages(15)
        break
      case 'core':
      case 'studio':
        setMaxMessages(-1) // Unlimited
        break
      default:
        setMaxMessages(15)
    }
  }, [profile])

  // Calculate remaining messages
  useEffect(() => {
    if (maxMessages === -1) {
      setRemainingMessages(-1) // Unlimited
    } else {
      setRemainingMessages(Math.max(0, maxMessages - messageCount))
    }
  }, [messageCount, maxMessages])

  // Fetch usage on mount and when tier changes
  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  const incrementMessageCount = useCallback(() => {
    if (profile?.subscription_tier === 'free') {
      setMessageCount(prev => prev + 1)
    }
  }, [profile?.subscription_tier])

  // ✅ Don't default to "free" if profile hasn't loaded yet
  if (loading || !profile) {
    return {
      tier: "loading",
      loading: true,
      canUseFeature: () => false,
      showUpgradeModal: () => {},
      messageCount: 0,
      maxMessages: 0,
      remainingMessages: 0,
      incrementMessageCount: () => {},
      refreshUsage: () => Promise.resolve(),
      forceRefresh
    };
  }

  // Debug logging
  console.log("🔍 useTierAccess - profile:", profile)
  console.log("🔍 useTierAccess - tier:", profile?.subscription_tier || "free")

  const canUseFeature = (feature: string) => {
    if (loading) return false
    if (!profile) return false // Don't allow features if profile is not loaded
    
    const tier = profile.subscription_tier || "free"
    if (tier === "studio") return true
    if (tier === "core") {
      // Core tier gets text, image, audio, and other features (not studio-only)
      return feature !== "studio-only"
    }
    if (tier === "free") {
      // Free tier only gets text chat
      return feature === "text"
    }
    return false
  }

  const showUpgradeModal = (feature: string) => {
    console.log(`⚠️ Upgrade required for: ${feature}`)
  }

  return { 
    tier: profile?.subscription_tier || "free", 
    loading, 
    canUseFeature, 
    showUpgradeModal,
    messageCount,
    maxMessages,
    remainingMessages,
    incrementMessageCount,
    refreshUsage: fetchUsage,
    forceRefresh
  }
}