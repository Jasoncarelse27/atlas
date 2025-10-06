import { atlasDB } from "@/database/atlasDB"
import { supabase } from "@/lib/supabaseClient"

export let lastSyncedAt = 0
export let isSyncingNow = false

export async function markSyncing(state: boolean) {
  isSyncingNow = state
  if (!state) lastSyncedAt = Date.now()
}

export const syncService = {
  async syncAll(userId: string, tier: string) {
    if (tier === "free") {
      console.log("[SYNC] Offline mode active (Free Tier)")
      return
    }

    console.log("[SYNC] Starting Dexie ↔ Supabase merge…")
    await markSyncing(true)

    try {
      // ✅ Pull remote messages from Supabase
      const { data: remote, error: pullErr } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at")

      if (pullErr) throw pullErr

      const local = await atlasDB.messages.toArray()

      // Merge: add missing remote messages to Dexie
      for (const msg of remote || []) {
        const exists = local.find((m) => m.id === msg.id)
        if (!exists) {
          await atlasDB.messages.put({
            id: msg.id,
            conversationId: msg.conversation_id,
            userId: msg.user_id,
            role: msg.role,
            type: "text", // Default type
            content: msg.content,
            timestamp: msg.created_at,
            synced: true,
            updatedAt: msg.updated_at
          })
        }
      }

      // ✅ Push unsynced local messages to Supabase
      const unsynced = local.filter((m) => !m.synced)
      for (const msg of unsynced) {
        const { error: pushErr } = await supabase.from("messages").upsert({
          id: msg.id,
          conversation_id: msg.conversationId,
          user_id: msg.userId,
          role: msg.role,
          content: msg.content,
          created_at: msg.timestamp,
          updated_at: msg.updatedAt || msg.timestamp
        })
        if (!pushErr) await atlasDB.messages.update(msg.id, { synced: true })
      }

      console.log("[SYNC] Dexie ↔ Supabase merge complete ✅")
    } catch (err) {
      console.error("[SYNC] Error:", err)
    } finally {
      await markSyncing(false)
    }
  },
}

// Background sync functionality
let syncInterval: ReturnType<typeof setInterval> | null = null

export function startBackgroundSync(userId: string, tier: string) {
  if (tier === "free") {
    console.log("[SYNC] Background sync disabled for Free tier")
    return
  }

  // Run immediately on load
  syncService.syncAll(userId, tier)

  // Re-sync every 30 seconds
  if (!syncInterval) {
    syncInterval = setInterval(() => {
      console.log("[SYNC] Running scheduled background sync...")
      syncService.syncAll(userId, tier)
    }, 30000)
  }

  // Also sync when app regains focus (Web + React Native)
  if (typeof window !== "undefined") {
    window.addEventListener("focus", () => {
      console.log("[SYNC] Window focused – running instant sync")
      syncService.syncAll(userId, tier)
    })
  }

  console.log("[SYNC] Background sync active ✅")
}

export function stopBackgroundSync() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
    console.log("[SYNC] Background sync stopped ⏹️")
  }
}