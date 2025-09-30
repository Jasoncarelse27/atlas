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
    if (tier === "studio") return true
    if (tier === "core") return feature === "image" || feature === "audio"
    return false
  }

  return { tier, hasAccess, loading }
}