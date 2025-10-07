import { isPaidTier } from "@/config/featureAccess";
import { atlasDB } from "@/database/atlasDB";
import { supabase } from "@/lib/supabaseClient";

// 🎯 FUTURE-PROOF FIX: Define types for Supabase message schema
type SupabaseMessage = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  updated_at?: string;
};

export let lastSyncedAt = 0
export let isSyncingNow = false

export async function markSyncing(state: boolean) {
  isSyncingNow = state
  if (!state) lastSyncedAt = Date.now()
}

export const syncService = {
  async syncAll(userId: string, tier: 'free' | 'core' | 'studio') {
    // ✅ Use centralized tier config
    if (!isPaidTier(tier)) {
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
        .order("created_at") as { data: SupabaseMessage[] | null; error: any }

      if (pullErr) {
        console.error('[SYNC] Failed to fetch remote messages:', pullErr);
        throw pullErr;
      }

      const local = await atlasDB.messages.toArray()

      // Merge: add missing remote messages to Dexie
      for (const msg of remote || []) {
        const exists = local.find((m) => m.id === msg.id)
        if (!exists) {
          await atlasDB.messages.put({
            id: msg.id,
            conversationId: msg.conversation_id,
            userId: userId, // Use userId from function parameter
            role: msg.role,
            type: "text", // Default type
            content: msg.content,
            timestamp: msg.created_at,
            synced: true,
            updatedAt: msg.created_at
          })
        }
      }

      // ✅ Push unsynced local messages to Supabase
      const unsynced = local.filter((m) => !m.synced)
      for (const msg of unsynced) {
        // 🎯 FUTURE-PROOF FIX: Validate and format message data for Supabase schema
        // Skip messages with invalid data
        if (!msg.conversationId || !msg.role || !msg.content) {
          console.warn('[SYNC] Skipping invalid message:', msg.id);
          continue;
        }

        // Ensure content is a string (Supabase expects TEXT)
        let contentText = msg.content as string;
        if (typeof msg.content === 'object' && msg.content !== null) {
          contentText = (msg.content as any).text || JSON.stringify(msg.content);
        }

        const messageData: SupabaseMessage = {
          id: msg.id,
          conversation_id: msg.conversationId,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: contentText,
          created_at: msg.timestamp,
        };

        const { error: pushErr } = await supabase.from("messages").upsert(messageData as any)
        
        if (pushErr) {
          console.error('[SYNC] Failed to sync message:', msg.id, pushErr);
        } else {
          await atlasDB.messages.update(msg.id, { synced: true })
        }
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

export function startBackgroundSync(userId: string, tier: 'free' | 'core' | 'studio') {
  // ✅ Use centralized tier config
  if (!isPaidTier(tier)) {
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