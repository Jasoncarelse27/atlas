// 🎯 ATLAS TIER-BASED CONVERSATION DELETION SERVICE
// This service implements revenue-aligned deletion logic:
// - Free: Local-only deletion (zero server cost)
// - Core: Hard delete from server + local (simple sync)
// - Studio: Soft delete with restore capability (premium feature)

import { atlasDB } from '@/database/atlasDB';
import { supabase } from '@/lib/supabaseClient';
import { subscriptionApi } from '@/services/subscriptionApi';

export interface DeleteResult {
  success: boolean;
  tier: 'free' | 'core' | 'studio';
  message: string;
}

/**
 * Delete conversation based on user's subscription tier
 * @param conversationId - ID of conversation to delete
 * @param userId - ID of authenticated user
 * @returns Result with tier information for upgrade prompts
 */
export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<DeleteResult> {
  try {
    // Get user's tier
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    const tier = await subscriptionApi.getUserTier(userId, token);
    
    console.log(`[ConversationDelete] Deleting conversation ${conversationId} for ${tier} tier user`);
    
    // Execute tier-specific deletion
    switch (tier) {
      case 'free':
        await deleteLocalOnly(conversationId);
        return {
          success: true,
          tier: 'free',
          message: 'Conversation deleted locally. Upgrade to Core to sync deletions across devices.'
        };
        
      case 'core':
        await hardDeleteRemoteAndLocal(conversationId, userId);
        return {
          success: true,
          tier: 'core',
          message: 'Conversation permanently deleted. Upgrade to Studio to restore deleted conversations.'
        };
        
      case 'studio':
        await softDeleteRemoteAndLocal(conversationId, userId);
        return {
          success: true,
          tier: 'studio',
          message: 'Conversation deleted. You can restore it anytime from your deleted items.'
        };
        
      default:
        // Fallback to local-only deletion for unknown tiers
        console.warn(`[ConversationDelete] Unknown tier: ${tier}, defaulting to local deletion`);
        await deleteLocalOnly(conversationId);
        return {
          success: true,
          tier: 'free',
          message: 'Conversation deleted locally.'
        };
    }
  } catch (error) {
    console.error('[ConversationDelete] ❌ Failed to delete conversation:', error);
    throw error;
  }
}

/**
 * FREE TIER: Delete conversation from local Dexie only
 * - Zero server cost
 * - Device-specific deletion
 * - No cross-device sync
 */
async function deleteLocalOnly(conversationId: string): Promise<void> {
  console.log('[ConversationDelete] 📴 Free tier - Local-only hard delete');
  
  // Hard delete from local Dexie
  await atlasDB.conversations.delete(conversationId);
  await atlasDB.messages.where('conversationId').equals(conversationId).delete();
  
  console.log('[ConversationDelete] ✅ Deleted from local Dexie only');
}

/**
 * CORE TIER: Hard delete from Supabase + local Dexie
 * - Permanent deletion
 * - Syncs across all devices
 * - Cannot be restored
 */
async function hardDeleteRemoteAndLocal(
  conversationId: string,
  userId: string
): Promise<void> {
  console.log('[ConversationDelete] ⚙️ Core tier - Hard delete (server + local)');
  
  // Hard delete from Supabase (permanent)
  const { error: convError } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId);
    
  if (convError) {
    console.error('[ConversationDelete] ❌ Supabase conversation delete error:', convError);
    throw convError;
  }
  
  // Messages will cascade delete via foreign key constraint
  console.log('[ConversationDelete] ✅ Hard deleted from Supabase');
  
  // Hard delete from local Dexie
  await atlasDB.conversations.delete(conversationId);
  await atlasDB.messages.where('conversationId').equals(conversationId).delete();
  
  console.log('[ConversationDelete] ✅ Hard deleted from local Dexie');
}

/**
 * STUDIO TIER: Soft delete with deleted_at timestamp
 * - Restorable deletion
 * - Syncs across all devices
 * - Can be restored anytime
 */
async function softDeleteRemoteAndLocal(
  conversationId: string,
  userId: string
): Promise<void> {
  console.log('[ConversationDelete] 🩵 Studio tier - Soft delete (recoverable)');
  
  const deletedAt = new Date().toISOString();
  
  // Soft delete from Supabase using RPC function
  const { error: rpcError } = await supabase.rpc('delete_conversation_soft' as any, {
    p_user: userId,
    p_conversation: conversationId
  } as any);
  
  if (rpcError) {
    console.error('[ConversationDelete] ❌ Supabase soft delete error:', rpcError);
    throw rpcError;
  }
  
  console.log('[ConversationDelete] ✅ Soft deleted from Supabase');
  
  // Soft delete from local Dexie (set deletedAt timestamp)
  await atlasDB.conversations.update(conversationId, { deletedAt });
  await atlasDB.messages.where('conversationId').equals(conversationId).modify({ deletedAt });
  
  console.log('[ConversationDelete] ✅ Soft deleted from local Dexie');
}

/**
 * STUDIO TIER ONLY: Restore a soft-deleted conversation
 * @param conversationId - ID of conversation to restore
 * @param userId - ID of authenticated user
 */
export async function restoreConversation(
  conversationId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Verify user has Studio tier
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    const tier = await subscriptionApi.getUserTier(userId, token);
    
    if (tier !== 'studio') {
      console.warn('[ConversationDelete] ❌ Restore unavailable for non-Studio tier');
      return {
        success: false,
        message: 'Restore feature is only available for Studio tier users.'
      };
    }
    
    console.log('[ConversationDelete] 🔄 Restoring conversation:', conversationId);
    
    // Restore in Supabase (clear deleted_at)
    // Note: Type assertion needed due to Supabase type generation limitations
    const { error: supabaseError } = await (supabase as any)
      .from('conversations')
      .update({ deleted_at: null })
      .eq('id', conversationId)
      .eq('user_id', userId);
      
    if (supabaseError) {
      console.error('[ConversationDelete] ❌ Supabase restore error:', supabaseError);
      throw supabaseError;
    }
    
    // Restore messages in Supabase
    const { error: messagesError } = await (supabase as any)
      .from('messages')
      .update({ deleted_at: null })
      .eq('conversation_id', conversationId);
      
    if (messagesError) {
      console.error('[ConversationDelete] ❌ Messages restore error:', messagesError);
      throw messagesError;
    }
    
    console.log('[ConversationDelete] ✅ Restored in Supabase');
    
    // Restore in local Dexie (clear deletedAt)
    await atlasDB.conversations.update(conversationId, { deletedAt: undefined });
    await atlasDB.messages
      .where('conversationId')
      .equals(conversationId)
      .modify({ deletedAt: undefined });
    
    console.log('[ConversationDelete] ✅ Restored in local Dexie');
    
    return {
      success: true,
      message: 'Conversation restored successfully!'
    };
  } catch (error) {
    console.error('[ConversationDelete] ❌ Failed to restore conversation:', error);
    throw error;
  }
}

