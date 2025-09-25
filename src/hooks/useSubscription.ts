import { useCallback, useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export function useSubscription(userId?: string) {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    console.log(`📊 Fetching profile for userId: ${userId}`)
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)  // ✅ always string
      .single()
    if (!error && data) {
      console.log("✅ Profile fetched:", data)
      console.log("🔍 Profile tier:", data.subscription_tier)
      setProfile(data)
        } else {
      console.error("❌ Profile fetch error:", error)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    
    // Initial fetch
    fetchProfile()

    let pollingInterval: NodeJS.Timeout | null = null

    const channel = supabase
      .channel(`profiles-changes-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          console.log("🔄 Realtime profile update:", payload.new)
          if (payload.new) setProfile(payload.new)
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Subscribed to profile realtime updates")
          // Clear any existing polling when real-time is working
          if (pollingInterval) {
            clearInterval(pollingInterval)
            pollingInterval = null
          }
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          console.warn("⚠️ Realtime subscription closed, falling back to polling")
          // Start polling fallback
          if (!pollingInterval) {
            pollingInterval = setInterval(() => {
              console.log("🔄 Polling for profile updates...")
              fetchProfile()
            }, 60000) // Poll every 60 seconds
          }
        }
      })

    return () => { 
      supabase.removeChannel(channel)
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [userId]) // Removed fetchProfile from dependencies to prevent excessive re-renders

  // Force refresh function
  const forceRefresh = useCallback(async () => {
    console.log("🔄 Force refreshing profile...")
    await fetchProfile()
  }, [fetchProfile])

  return { profile, loading, refresh: fetchProfile, forceRefresh }
}