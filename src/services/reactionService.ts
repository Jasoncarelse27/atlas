/**
 * Message Reactions Service
 * Handles emoji reactions on messages (Phase 1 Quick Win)
 * Industry standard pattern: Slack, Discord, WhatsApp
 */

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';

export type ReactionEmoji = '👍' | '❤️' | '😂' | '🤔' | '🎯' | '✅' | '🔥' | '✨';

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: ReactionEmoji;
  created_at: string;
}

export interface ReactionSummary {
  emoji: ReactionEmoji;
  count: number;
  user_ids: string[]; // Users who reacted
  has_user_reacted: boolean; // Current user has reacted
}

/**
 * Get all reactions for a message
 */
export async function getMessageReactions(
  messageId: string,
  currentUserId: string | null
): Promise<ReactionSummary[]> {
  try {
    const { data, error } = await supabase
      .from('message_reactions')
      .select('emoji, user_id')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('[ReactionService] Failed to fetch reactions:', error);
      return [];
    }

    // Group reactions by emoji
    const reactionMap = new Map<ReactionEmoji, ReactionSummary>();

    data?.forEach((reaction) => {
      const emoji = reaction.emoji as ReactionEmoji;
      const userId = reaction.user_id;

      if (!reactionMap.has(emoji)) {
        reactionMap.set(emoji, {
          emoji,
          count: 0,
          user_ids: [],
          has_user_reacted: false,
        });
      }

      const summary = reactionMap.get(emoji)!;
      summary.count++;
      summary.user_ids.push(userId);

      if (currentUserId && userId === currentUserId) {
        summary.has_user_reacted = true;
      }
    });

    return Array.from(reactionMap.values()).sort((a, b) => b.count - a.count);
  } catch (error) {
    logger.error('[ReactionService] Error fetching reactions:', error);
    return [];
  }
}

/**
 * Add a reaction to a message
 */
export async function addReaction(
  messageId: string,
  userId: string,
  emoji: ReactionEmoji
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('message_reactions')
      .insert({
        message_id: messageId,
        user_id: userId,
        emoji,
      });

    if (error) {
      // If already exists, that's fine (idempotent)
      if (error.code === '23505') {
        logger.debug('[ReactionService] Reaction already exists');
        return true;
      }
      logger.error('[ReactionService] Failed to add reaction:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[ReactionService] Error adding reaction:', error);
    return false;
  }
}

/**
 * Remove a reaction from a message
 */
export async function removeReaction(
  messageId: string,
  userId: string,
  emoji: ReactionEmoji
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji);

    if (error) {
      logger.error('[ReactionService] Failed to remove reaction:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[ReactionService] Error removing reaction:', error);
    return false;
  }
}

/**
 * Toggle a reaction (add if not exists, remove if exists)
 */
export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: ReactionEmoji
): Promise<boolean> {
  try {
    // Check if reaction exists
    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .single();

    if (existing) {
      // Remove reaction
      return await removeReaction(messageId, userId, emoji);
    } else {
      // Add reaction
      return await addReaction(messageId, userId, emoji);
    }
  } catch (error) {
    logger.error('[ReactionService] Error toggling reaction:', error);
    return false;
  }
}

/**
 * Standard quick reactions (5-7 most common)
 * Covers 80% of use cases per research
 */
export const QUICK_REACTIONS: ReactionEmoji[] = ['👍', '❤️', '😂', '🤔', '🎯', '✅'];


