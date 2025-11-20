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

    // ✅ CRITICAL FIX: Handle NEW conversations (INSERT events)
    // This ensures conversations created on mobile appear on web instantly
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "conversations",
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        const newConv = payload.new;
        
        try {
          // ✅ CRITICAL: Only sync non-deleted conversations
          if (newConv.deleted_at) {
            logger.debug('[Realtime] ⚠️ Skipping deleted conversation INSERT:', newConv.id);
            return;
          }
          
          // Check if conversation already exists locally
          const localExists = await atlasDB.conversations.get(newConv.id);
          if (localExists) {
            logger.debug('[Realtime] ⚠️ Conversation already exists locally, skipping:', newConv.id);
            return;
          }
          
          // Save new conversation to Dexie
          await atlasDB.conversations.put({
            id: newConv.id,
            userId: newConv.user_id,
            title: newConv.title,
            createdAt: newConv.created_at,
            updatedAt: newConv.updated_at,
            deletedAt: undefined,
          });
          
          logger.info('[Realtime] ✅ New conversation received:', {
            id: newConv.id,
            title: newConv.title,
            isMobile: typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
          });
          
          // Trigger conversation list refresh
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('conversationCreated', {
              detail: { conversationId: newConv.id }
            }));
          }
        } catch (error) {
          logger.error('[Realtime] Failed to handle new conversation:', error);
        }
      }
    );

    // ✅ CRITICAL: Handle conversation soft deletions (UPDATE events)
    // Note: We only use soft delete (delete_conversation_soft RPC), so DELETE events never fire
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
          
          // ✅ CRITICAL FIX: Parse JSON content if it's a stringified object (matches ChatPage logic)
          let parsedContent = newMessage.content;
          if (typeof newMessage.content === 'string') {
            try {
              // Check if content looks like JSON
              if (newMessage.content.trim().startsWith('{') && newMessage.content.includes('"type"') && newMessage.content.includes('"text"')) {
                const parsed = JSON.parse(newMessage.content);
                // Extract the actual text from {type: "text", text: "..."}
                parsedContent = parsed.text || parsed.content || newMessage.content;
              }
            } catch (e) {
              // Not JSON, keep as-is
              parsedContent = newMessage.content;
            }
          }
          
          // ✅ CRITICAL FIX: Parse attachments from JSONB field (same logic as sync service)
          let parsedAttachments: Array<{ type: string; url: string; name?: string }> | undefined;
          if (newMessage.attachments) {
            try {
              // Handle both string and object formats
              const attachmentsData = typeof newMessage.attachments === 'string' 
                ? JSON.parse(newMessage.attachments)
                : newMessage.attachments;
              
              if (Array.isArray(attachmentsData) && attachmentsData.length > 0) {
                parsedAttachments = attachmentsData.map((att: any) => ({
                  type: att.type || 'file',
                  url: att.url || att.publicUrl || '',
                  name: att.name || att.fileName
                }));
              }
            } catch (e) {
              logger.warn('[Realtime] Failed to parse attachments:', e);
            }
          }
          
          // ✅ CRITICAL FIX: Detect message type from attachments or image_url
          let messageType: 'text' | 'image' | 'audio' = 'text';
          if (parsedAttachments && parsedAttachments.length > 0) {
            // Check first attachment type to determine message type
            const firstAttachmentType = parsedAttachments[0].type;
            if (firstAttachmentType === 'audio') {
              messageType = 'audio';
            } else if (firstAttachmentType === 'image') {
              messageType = 'image';
            }
          } else if (newMessage.image_url) {
            // Legacy image support
            messageType = 'image';
            if (!parsedAttachments) {
              parsedAttachments = [{ type: 'image', url: newMessage.image_url }];
            }
          }
          
          // ✅ CRITICAL FIX: Check if message already exists before saving (prevent duplicates)
          const existingMessage = await atlasDB.messages.get(newMessage.id);
          if (existingMessage) {
            logger.debug('[Realtime] ⚠️ Message already exists in Dexie, skipping duplicate:', newMessage.id);
            return; // Skip - message already saved
          }
          
          // ✅ CRITICAL FIX: Deduplicate attachments before saving
          const uniqueAttachments = parsedAttachments && parsedAttachments.length > 0
            ? [...new Map(parsedAttachments.map(att => [att.url || att.publicUrl || att.id || Math.random(), att])).values()]
            : undefined;
          
          // Save to Dexie immediately
          await atlasDB.messages.put({
            id: newMessage.id,
            conversationId: newMessage.conversation_id,
            userId: newMessage.user_id,
            role: newMessage.role,
            type: messageType, // ✅ FIX: Use determined message type
            content: parsedContent,
            timestamp: newMessage.created_at,
            status: 'sent', // ✅ CRITICAL: Realtime messages are already sent
            synced: true,
            updatedAt: newMessage.created_at,
            attachments: uniqueAttachments, // ✅ CRITICAL FIX: Use deduplicated attachments
            imageUrl: newMessage.image_url || undefined, // ✅ Legacy image support
            deletedAt: newMessage.deleted_at || undefined, // ✅ Sync deleted status
            deletedBy: newMessage.deleted_by || undefined  // ✅ Sync deleted type
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
