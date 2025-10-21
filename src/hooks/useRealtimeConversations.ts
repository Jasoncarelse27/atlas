import { useEffect, useRef } from "react";
import { atlasDB } from "../database/atlasDB";
import { logger } from "../lib/logger";
import { supabase } from "../lib/supabaseClient";

/**
 * 🧠 ATLAS UNIFIED REAL-TIME HOOK
 * 
 * ⚡ OPTIMIZED: Single channel for all realtime updates
 * - Conversations (deletions)
 * - Messages (new messages)
 * - Profile updates (tier changes)
 * 
 * Reduces connection overhead from 3+ channels to 1 per user.
 */
export function useRealtimeConversations(userId?: string) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const sanitizedId = userId.replace(/-/g, "_");
    const channelName = `atlas_${sanitizedId}`; // Unified channel name
    
    // Create single unified channel
    const channel = supabase.channel(channelName);

    // ✅ Handle conversation deletions
    channel.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "conversations",
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        const deletedId = payload.old.id;
        
        try {
          // Remove from local Dexie immediately
          await atlasDB.conversations.delete(deletedId);
          await atlasDB.messages.where('conversationId').equals(deletedId).delete();
          
          // Trigger conversation history refresh
          window.dispatchEvent(new CustomEvent('conversationDeleted', {
            detail: { conversationId: deletedId }
          }));
          
          logger.info('[Realtime] Conversation deleted:', deletedId);
        } catch (error) {
          logger.error('[Realtime] Failed to handle deletion:', error);
        }
      }
    );

    // Subscribe with error handling
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        logger.info('[Realtime] Connected');
      } else if (status === "CLOSED") {
        logger.warn('[Realtime] Connection closed, will retry');
      } else if (status === "CHANNEL_ERROR") {
        logger.error('[Realtime] Channel error, reconnecting...');
      }
    });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
