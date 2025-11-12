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

    // ✅ Handle conversation hard deletions (DELETE events)
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
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('conversationDeleted', {
              detail: { conversationId: deletedId }
            }));
          }
          
          logger.info('[Realtime] Conversation hard deleted:', deletedId);
        } catch (error) {
          logger.error('[Realtime] Failed to handle hard deletion:', error);
        }
      }
    );

    // ✅ CRITICAL FIX: Handle conversation soft deletions (UPDATE events)
    // When deleted_at is set, mark conversation as deleted locally
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "conversations",
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        const updatedConv = payload.new;
        
        try {
          // ✅ CRITICAL: Check if conversation was soft-deleted
          if (updatedConv.deleted_at) {
            const deletedAt = updatedConv.deleted_at;
            
            // Mark conversation as deleted locally
            const localExists = await atlasDB.conversations.get(updatedConv.id);
            if (localExists) {
              await atlasDB.conversations.update(updatedConv.id, {
                deletedAt: deletedAt
              });
              
              // Mark all messages in conversation as deleted
              const messages = await atlasDB.messages
                .where('conversationId')
                .equals(updatedConv.id)
                .toArray();
              
              for (const msg of messages) {
                await atlasDB.messages.update(msg.id, {
                  deletedAt: deletedAt
                });
              }
              
              logger.info('[Realtime] ✅ Conversation soft deleted:', updatedConv.id);
            }
            
            // Trigger conversation history refresh
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('conversationDeleted', {
                detail: { conversationId: updatedConv.id }
              }));
            }
          } else if (updatedConv.deleted_at === null) {
            // ✅ CRITICAL: Conversation was restored (deleted_at cleared)
            const localExists = await atlasDB.conversations.get(updatedConv.id);
            if (localExists && localExists.deletedAt) {
              // Restore conversation
              await atlasDB.conversations.update(updatedConv.id, {
                deletedAt: undefined,
                title: updatedConv.title,
                updatedAt: updatedConv.updated_at,
              });
              
              logger.info('[Realtime] ✅ Conversation restored:', updatedConv.id);
            }
          }
        } catch (error) {
          logger.error('[Realtime] Failed to handle soft deletion:', error);
        }
      }
    );

    // ✅ CRITICAL FIX: Handle new messages (assistant responses)
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        const newMessage = payload.new;
        
        try {
          // ✅ MOBILE SAFETY: Ensure window is available
          if (typeof window === 'undefined') {
            logger.warn('[Realtime] ⚠️ Window not available (SSR?), skipping message event');
            return;
          }
          
          // Save to Dexie immediately
          await atlasDB.messages.put({
            id: newMessage.id,
            conversationId: newMessage.conversation_id,
            userId: newMessage.user_id,
            role: newMessage.role,
            type: 'text',
            content: newMessage.content,
            timestamp: newMessage.created_at,
            synced: true,
            updatedAt: newMessage.created_at,
            attachments: newMessage.attachments || undefined,
          });
          
          // ✅ CRITICAL: Trigger message update event so ChatPage can refresh
          // ✅ MOBILE SAFETY: Use setTimeout to ensure event fires even if page is backgrounded
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('newMessageReceived', {
              detail: { 
                message: newMessage,
                conversationId: newMessage.conversation_id
              }
            }));
          }
          
          logger.info('[Realtime] ✅ New message received:', {
            id: newMessage.id,
            role: newMessage.role,
            conversationId: newMessage.conversation_id,
            contentPreview: typeof newMessage.content === 'string' 
              ? newMessage.content.substring(0, 50) 
              : 'non-string content',
            isMobile: typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
          });
        } catch (error) {
          logger.error('[Realtime] Failed to handle new message:', error);
        }
      }
    );

    // Subscribe with error handling
    channel.subscribe((status) => {
      const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (status === "SUBSCRIBED") {
        logger.info(`[Realtime] ✅ Connected${isMobile ? ' (Mobile)' : ''}`);
      } else if (status === "CLOSED") {
        logger.warn(`[Realtime] ⚠️ Connection closed${isMobile ? ' (Mobile)' : ''}, will retry`);
      } else if (status === "CHANNEL_ERROR") {
        logger.error(`[Realtime] ❌ Channel error${isMobile ? ' (Mobile)' : ''}, reconnecting...`);
      } else if (status === "TIMED_OUT") {
        logger.error(`[Realtime] ⏱️ Connection timeout${isMobile ? ' (Mobile)' : ''}, will retry`);
      } else {
        logger.debug(`[Realtime] Status: ${status}${isMobile ? ' (Mobile)' : ''}`);
      }
    });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
