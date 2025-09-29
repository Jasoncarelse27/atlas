import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"

export function useTierAccess(userId?: string) {
  const [tier, setTier] = useState<"free" | "core" | "studio" | null>(null)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    let active = true

    const fetchTier = async () => {
      try {
        console.log("🔍 useTierAccess - Fetching subscription tier...")

        if (!userId) {
          if (active) {
            setTier("free")
          }
          return
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("id", userId)
          .single()

        if (!active) return

        if (!error && data?.subscription_tier) {
          console.log("🔍 useTierAccess - tier from Supabase:", data.subscription_tier)
          const newTier = data.subscription_tier as "free" | "core" | "studio"
          setTier(newTier)
          setProfile(data)
          console.log("🔍 useTierAccess - ✅ Tier set to:", newTier)
        } else {
          console.warn("🔍 useTierAccess - ⚠️ Invalid or missing tier, defaulting to free:", error)
          setTier("free")
        }
      } catch (error) {
        console.error("🔍 useTierAccess - ❌ Failed to fetch tier:", error)
        if (active) setTier("free")
      } finally {
        // ✅ No loading state needed - tier is either set or null
        console.log("🔍 useTierAccess - ✅ Loading finished, tier:", tier)
      }
    }

    fetchTier()

    // Real-time listener for tier updates
    const channel = supabase
      .channel("tier-updates")
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "profiles", 
          filter: `id=eq.${userId}` 
        },
        (payload) => {
          console.log("🔄 Real-time tier update:", payload.new?.subscription_tier)
          if (active) {
            setTier(payload.new?.subscription_tier || "free")
          }
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [userId])

  // ✅ helper
  const requireTier = (required: "core" | "studio") => {
    if (required === "core" && tier === "free") return false
    if (required === "studio" && tier !== "studio") return false
    return true
  }

  const canUseFeature = (feature: string) => {
    if (tier === null) return false
    if (!profile) return false
    
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
    tier, 
    profile, 
    isLoading: tier === null,
    requireTier,
    canUseFeature, 
    showUpgradeModal
  }
}