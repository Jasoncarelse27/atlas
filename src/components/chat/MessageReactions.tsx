/**
 * Message Reactions Component
 * Displays and manages emoji reactions on messages
 * Industry standard pattern: Slack, Discord, WhatsApp
 */

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabaseClient';
import {
  getMessageReactions,
  toggleReaction,
  type ReactionEmoji,
  type ReactionSummary,
} from '../../services/reactionService';

interface MessageReactionsProps {
  messageId: string;
  userId: string | null;
  className?: string;
}

export function MessageReactions({ messageId, userId, className = '' }: MessageReactionsProps) {
  const [reactions, setReactions] = useState<ReactionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load reactions on mount and subscribe to changes
  useEffect(() => {
    if (!messageId) return;

    // Initial load
    loadReactions();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`message-reactions-${messageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=eq.${messageId}`,
        },
        () => {
          // Reload reactions on any change
          loadReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageId, userId]);


  const loadReactions = async () => {
    if (!messageId || !userId) return;

    try {
      const reactionSummaries = await getMessageReactions(messageId, userId);
      setReactions(reactionSummaries);
    } catch (error) {
      logger.error('[MessageReactions] Failed to load reactions:', error);
    }
  };

  const handleReactionClick = async (emoji: ReactionEmoji) => {
    if (!userId) {
      toast.error('Please log in to react to messages');
      return;
    }

    setIsLoading(true);
    try {
      const success = await toggleReaction(messageId, userId, emoji);
      if (success) {
        // Reactions will update via real-time subscription
      } else {
        toast.error('Failed to add reaction. Please try again.');
      }
    } catch (error) {
      logger.error('[MessageReactions] Error toggling reaction:', error);
      toast.error('Failed to add reaction. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render if no reactions and user not logged in
  if (reactions.length === 0 && !userId) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {/* Existing Reactions */}
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.button
            key={reaction.emoji}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => handleReactionClick(reaction.emoji)}
            disabled={isLoading || !userId}
            className={`
              flex items-center gap-1 px-2 py-1 rounded-full text-sm
              transition-all duration-200
              ${
                reaction.has_user_reacted
                  ? 'bg-atlas-sage/30 border-2 border-atlas-sage'
                  : 'bg-atlas-pearl/80 border border-atlas-border hover:bg-atlas-sand/20'
              }
              ${isLoading || !userId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            title={`${reaction.count} ${reaction.count === 1 ? 'reaction' : 'reactions'}`}
          >
            <span className="text-base">{reaction.emoji}</span>
            <span className="text-xs font-medium text-atlas-text-medium">
              {reaction.count > 0 ? reaction.count : ''}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>

    </div>
  );
}



