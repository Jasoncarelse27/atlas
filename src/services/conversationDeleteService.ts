// 🎯 ATLAS UNIFIED CONVERSATION DELETION SERVICE
// Uses soft delete for proper sync across mobile and web
// Prevents deleted conversations from reappearing after sync

import { atlasDB } from '@/database/atlasDB';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import { redisCacheService } from './redisCacheService';

export interface DeleteResult {
  success: boolean;
  message: string;
}

/**
 * Soft delete conversation from both Supabase and local Dexie
 * Uses soft delete RPC to ensure proper sync across devices
 * @param conversationId - ID of conversation to delete
 * @param userId - ID of authenticated user
 * @returns Result with success status and message
 */
export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<DeleteResult> {
  try {
    logger.info(`[ConversationDelete] 🗑️ Soft deleting conversation: ${conversationId}`);
    
    // ✅ CRITICAL: Use soft delete RPC to set deleted_at timestamp
    // This ensures sync service can properly filter out deleted conversations
    const { error: rpcError } = await supabase.rpc('delete_conversation_soft', {
      p_user: userId,
      p_conversation: conversationId
    });
    
    if (rpcError) {
      logger.error('[ConversationDelete] ❌ Soft delete RPC error:', rpcError);
      throw new Error(`Failed to delete conversation: ${rpcError.message}`);
    }
    
    logger.info('[ConversationDelete] ✅ Soft deleted from Supabase');
    
    // 2. Update local Dexie with deletedAt timestamp
    const deletedAt = new Date().toISOString();
    try {
      // Mark conversation as deleted locally
      const existingConv = await atlasDB.conversations.get(conversationId);
      if (existingConv) {
        await atlasDB.conversations.update(conversationId, {
          deletedAt: deletedAt
        });
        logger.debug('[ConversationDelete] ✅ Marked conversation as deleted in local Dexie');
      } else {
        // If conversation doesn't exist locally, that's okay - sync will handle it
        logger.debug('[ConversationDelete] ⚠️ Conversation not found in local Dexie (will be filtered by sync)');
      }
      
      // Mark all messages in conversation as deleted
      const messages = await atlasDB.messages
        .where('conversationId')
        .equals(conversationId)
        .toArray();
      
      for (const msg of messages) {
        await atlasDB.messages.update(msg.id, {
          deletedAt: deletedAt
        });
      }
      
      if (messages.length > 0) {
        logger.debug(`[ConversationDelete] ✅ Marked ${messages.length} messages as deleted in local Dexie`);
      }
    } catch (dexieError) {
      logger.warn('[ConversationDelete] ⚠️ Local update failed (non-critical):', dexieError);
      // Continue - sync will handle it
    }
    
    // ✅ CRITICAL: Invalidate Redis cache
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();
      const tier = (profile as any)?.subscription_tier || 'free';
      
      await redisCacheService.invalidateUserCache(userId, tier);
      logger.debug('[ConversationDelete] ✅ Invalidated Redis cache');
    } catch (cacheError) {
      logger.warn('[ConversationDelete] ⚠️ Redis cache invalidation failed (non-critical):', cacheError);
    }
    
    // ✅ CRITICAL FIX: Dispatch event for UI refresh
    if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('conversationDeleted', {
      detail: { conversationId }
    }));
      logger.debug('[ConversationDelete] ✅ Dispatched deletion event for UI refresh');
    }
    
    logger.info('[ConversationDelete] ✅ Conversation soft deleted successfully');
    
    return {
      success: true,
      message: 'Conversation deleted successfully'
    };
  } catch (error) {
    logger.error('[ConversationDelete] ❌ Failed to delete conversation:', error);
    throw error;
  }
}