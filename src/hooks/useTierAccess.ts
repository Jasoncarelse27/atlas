import { useCallback, useEffect, useState } from "react"
import { useSubscription } from "./useSubscription"

export function useTierAccess(userId?: string) {
  const { profile, loading } = useSubscription(userId)
  const tier = profile?.subscription_tier || "free"
  
  // Usage tracking state
  const [messageCount, setMessageCount] = useState(0)
  const [maxMessages, setMaxMessages] = useState(15)
  const [remainingMessages, setRemainingMessages] = useState(15)

  // Fetch usage from backend
  const fetchUsage = useCallback(async () => {
    if (!userId || loading) return
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/usage/${userId}`, {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      
      if (response.ok) {
        const usage = await response.json()
        setMessageCount(usage.conversations_count || 0)
      }
    } catch (error) {
      console.warn('Failed to fetch usage:', error)
    }
  }, [userId, loading])

  // Set limits based on tier
  useEffect(() => {
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
  }, [tier])

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

  const canUseFeature = (feature: string) => {
    if (loading) return false
    if (tier === "studio") return true
    if (tier === "core") return feature !== "studio-only"
    return feature === "text"
  }

  const showUpgradeModal = (feature: string) => {
    console.log(`⚠️ Upgrade required for: ${feature}`)
  }

  const incrementMessageCount = useCallback(() => {
    if (tier === 'free') {
      setMessageCount(prev => prev + 1)
    }
  }, [tier])

  return { 
    tier, 
    loading, 
    canUseFeature, 
    showUpgradeModal,
    messageCount,
    maxMessages,
    remainingMessages,
    incrementMessageCount,
    refreshUsage: fetchUsage
  }
}