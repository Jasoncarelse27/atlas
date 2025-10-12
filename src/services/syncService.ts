import { canSyncCloud, isPaidTier } from "@/config/featureAccess";
import { atlasDB } from "@/database/atlasDB";
import { supabase } from "@/lib/supabaseClient";
import { conversationSyncService } from "./conversationSyncService";

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
    // ✅ Use centralized tier config for cloud sync
    if (!canSyncCloud(tier)) {
      console.log("[SYNC] Cloud sync disabled for tier:", tier);
      return
    }

    // ✅ Check if user is authenticated before syncing
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || !session.user) {
      console.log("[SYNC] No authenticated session - skipping sync")
      return
    }

    await markSyncing(true)

    try {
      // ✅ Pull remote messages from Supabase (filtered by user)
      const { data: remote, error: pullErr } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at") as { data: SupabaseMessage[] | null; error: any }

      if (pullErr) {
        // ✅ Handle 403 errors gracefully (user not authenticated)
        if (pullErr.status === 403) {
          console.log("[SYNC] 403 Forbidden - user not authenticated, stopping sync")
          return
        }
        throw pullErr;
      }

      const local = await atlasDB.messages.toArray()

      // ✅ PHASE 2: Only add missing remote messages (duplicate check)
      // Real-time listener is primary writer; this is for offline catch-up only
      for (const msg of remote || []) {
        const exists = local.find((m) => m.id === msg.id)
        if (!exists) {
          console.log("[SYNC] Adding missing message from remote:", msg.id);
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
        } else {
          console.log("[SYNC] Message already exists, skipping:", msg.id);
        }
      }

      // ✅ Push unsynced local messages to Supabase
      const unsynced = local.filter((m) => !m.synced)
      for (const msg of unsynced) {
        // 🎯 FUTURE-PROOF FIX: Validate and format message data for Supabase schema
        // Skip messages with invalid data
        if (!msg.conversationId || !msg.role || !msg.content) {
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
          // ✅ Handle 403 errors gracefully (user not authenticated)
          if ((pushErr as any).status === 403) {
            console.log("[SYNC] 403 Forbidden on push - user not authenticated, stopping sync")
            return
          }
          console.error("[SYNC] Push error:", pushErr)
        } else {
          await atlasDB.messages.update(msg.id, { synced: true })
        }
      }

      console.log("[SYNC] Dexie ↔ Supabase merge complete ✅")
    } catch (err) {
      console.error("[SYNC] Sync error:", err)
    } finally {
      await markSyncing(false)
    }
  },
}

// Background sync functionality
let syncInterval: ReturnType<typeof setInterval> | null = null

export function startBackgroundSync(userId: string, tier: 'free' | 'core' | 'studio') {
  // ✅ DELTA SYNC: Enable efficient background sync with delta updates
  console.log("[SYNC] 🚀 Starting delta sync background service");
  
  // ✅ Use centralized tier config
  if (!isPaidTier(tier)) {
    console.log("[SYNC] Free tier - no background sync");
    return;
  }

  // Run delta sync immediately on load
  conversationSyncService.deltaSync(userId).catch(error => {
    console.error("[SYNC] Initial delta sync failed:", error);
  });

  // Re-sync every 2 minutes with delta sync (optimized for performance)
  if (!syncInterval) {
    syncInterval = setInterval(() => {
      conversationSyncService.deltaSync(userId).catch(error => {
        console.error("[SYNC] Background delta sync failed:", error);
      });
    }, 120000) // 2 minutes
  }

  // Also sync when app regains focus (Web + React Native)
  if (typeof window !== "undefined") {
    window.addEventListener("focus", () => {
      conversationSyncService.deltaSync(userId).catch(error => {
        console.error("[SYNC] Focus delta sync failed:", error);
      });
    })
  }

  console.log("[SYNC] ✅ Delta sync background service active - unified architecture");
}

export function stopBackgroundSync() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}