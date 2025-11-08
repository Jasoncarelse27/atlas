/**
 * Conversation Guard Service
 * 
 * Ensures conversations exist before creating messages to prevent 23503 foreign key violations.
 * Uses upsert pattern for idempotent, race-condition-safe operations.
 */

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';

/**
 * Ensures a conversation exists in Supabase before creating messages.
 * Uses upsert pattern to handle race conditions safely.
 * 
 * @param conversationId - The conversation ID to ensure exists
 * @param userId - The authenticated user ID
 * @param timestamp - Optional timestamp (defaults to now)
 * @returns true if conversation exists or was created, false if creation failed
 */
export async function ensureConversationExists(
  conversationId: string,
  userId: string,
  timestamp?: string
): Promise<boolean> {
  if (!conversationId || !userId) {
    logger.error('[ConversationGuard] Missing required parameters:', { conversationId, userId });
    return false;
  }

  try {
    const { error } = await supabase
      .from('conversations')
      .upsert({
        id: conversationId,
        user_id: userId,
        title: 'Chat',
        created_at: timestamp || new Date().toISOString(),
        updated_at: timestamp || new Date().toISOString()
      } as any, {
        onConflict: 'id' // If exists, just update; if not, create
      });

    if (error) {
      // Check if it's a conflict (conversation was created concurrently)
      const isConflict = error.code === '23505' || 
                        error.message?.includes('duplicate') ||
                        error.message?.includes('already exists');
      
      if (isConflict) {
        logger.debug('[ConversationGuard] ✅ Conversation exists (conflict), continuing:', conversationId);
        return true; // Conversation exists now
      } else {
        logger.error('[ConversationGuard] ❌ Failed to ensure conversation exists:', {
          conversationId,
          userId,
          error,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: (error as any)?.details,
          errorHint: (error as any)?.hint
        });
        return false;
      }
    } else {
      logger.debug('[ConversationGuard] ✅ Conversation ensured:', conversationId);
      return true;
    }
  } catch (error) {
    logger.error('[ConversationGuard] ❌ Exception ensuring conversation:', {
      conversationId,
      userId,
      error
    });
    return false;
  }
}

