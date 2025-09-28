import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"

export function useTierAccess() {
  const [tier, setTier] = useState<"free" | "core" | "studio">("free")
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setTier("free")
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("id", user.id)
          .single()

        if (!error && data?.subscription_tier) {
          setTier(data.subscription_tier as "free" | "core" | "studio")
          setProfile(data)
          console.log("🔍 useTierAccess - tier from Supabase:", data.subscription_tier)
        } else {
          console.warn("🔍 useTierAccess - profile fetch error:", error)
          setTier("free")
        }
      } catch (error) {
        console.error("🔍 useTierAccess - fetch error:", error)
        setTier("free")
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  // ✅ helper
  const requireTier = (required: "core" | "studio") => {
    if (required === "core" && tier === "free") return false
    if (required === "studio" && tier !== "studio") return false
    return true
  }

  const canUseFeature = (feature: string) => {
    if (loading) return false
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
    loading, 
    requireTier,
    canUseFeature, 
    showUpgradeModal
  }
}