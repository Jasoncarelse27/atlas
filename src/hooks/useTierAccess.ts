// ==========================
// 📂 hooks/useTierAccess.ts
// ==========================
// ✅ Centralized tier gating
// ✅ Uses Supabase now
// ✅ FastSpring-ready later

import { supabase } from "@/lib/supabaseClient"
import { useEffect, useState } from "react"

type FeatureType = "camera" | "image" | "audio" | "file"

interface TierAccess {
  hasAccess: (feature: FeatureType) => boolean
  tier: string | null
  loading: boolean
}

export function useTierAccess(): TierAccess {
  const [tier, setTier] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTier = async () => {
      try {
        // 🔑 Get current user first
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user?.id) {
          console.log("[useTierAccess] No user found, defaulting to free")
          setTier("free")
          return
        }

        // 🔑 Pull from correct table with user filter
        const { data, error } = await supabase
          .from("profiles")  // Fixed: use correct table name
          .select("subscription_tier")
          .eq("id", user.id)  // Fixed: filter by current user
          .single()

        if (error) {
          console.warn("[useTierAccess] Supabase tier fetch failed:", error.message)
        }

        let resolvedTier = data?.subscription_tier || "free"

        // 🔑 FastSpring integration can be added later
        // const fastSpringTier = await paymentService.getCurrentTier()
        // if (fastSpringTier) resolvedTier = fastSpringTier

        setTier(resolvedTier)
      } catch (err) {
        console.error("[useTierAccess] Error:", err)
        setTier("free") // Fallback to free on error
      } finally {
        setLoading(false)
      }
    }

    fetchTier()
  }, [])

  const hasAccess = (feature: FeatureType): boolean => {
    if (!tier) return false

    const rules: Record<string, FeatureType[]> = {
      free: [],
      core: ["image", "audio"],
      studio: ["camera", "image", "audio", "file"],
    }

    return rules[tier]?.includes(feature) ?? false
  }

  return { hasAccess, tier, loading }
}