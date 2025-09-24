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
      setProfile(data)
        } else {
      console.error("❌ Profile fetch error:", error)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    fetchProfile()

    const channel = supabase
      .channel("profiles-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          console.log("🔄 Realtime profile update:", payload.new)
          if (payload.new) setProfile(payload.new)
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Subscribed to profile realtime updates")
        } else if (status === "CLOSED") {
          console.warn("⚠️ Realtime subscription closed, falling back to polling")
          // fallback to periodic backend fetch every 30s
          const interval = setInterval(fetchProfile, 30000)
          return () => clearInterval(interval)
        } else if (status === "CHANNEL_ERROR") {
          console.warn("⚠️ Realtime channel error, falling back to polling")
          // fallback to periodic backend fetch every 30s
          const interval = setInterval(fetchProfile, 30000)
          return () => clearInterval(interval)
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchProfile])

  return { profile, loading, refresh: fetchProfile }
}