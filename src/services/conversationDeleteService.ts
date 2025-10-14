// 🎯 ATLAS SIMPLIFIED CONVERSATION DELETION SERVICE
// Single, simple permanent deletion for all users across all tiers
// No tier complexity, no soft delete, no restore - just delete

import { atlasDB } from '@/database/atlasDB';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';

export interface DeleteResult {
  success: boolean;
  message: string;
}

/**
 * Delete conversation permanently from both Supabase and local Dexie
 * Simple, straightforward deletion for all users regardless of tier
 * @param conversationId - ID of conversation to delete
 * @param userId - ID of authenticated user
 * @returns Result with success status and message
 */
export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<DeleteResult> {
  try {
    logger.debug(`[ConversationDelete] Deleting conversation ${conversationId} permanently`);
    
    // 1. Delete from Supabase (CASCADE will handle messages)
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);
    
    if (error) {
      logger.error('[ConversationDelete] ❌ Supabase delete error:', error);
      throw error;
    }
    
    logger.debug('[ConversationDelete] ✅ Deleted from Supabase');
    
    // 2. Delete from local Dexie
    await atlasDB.conversations.delete(conversationId);
    await atlasDB.messages.where('conversationId').equals(conversationId).delete();
    
    logger.debug('[ConversationDelete] ✅ Deleted from local Dexie');
    
    return {
      success: true,
      message: 'Conversation deleted permanently'
    };
  } catch (error) {
    logger.error('[ConversationDelete] ❌ Failed to delete conversation:', error);
    throw error;
  }
}