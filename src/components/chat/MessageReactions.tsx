/**
 * Message Reactions Component
 * Displays and manages emoji reactions on messages
 * Industry standard pattern: Slack, Discord, WhatsApp
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Smile, Plus } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabaseClient';
import {
  getMessageReactions,
  toggleReaction,
  QUICK_REACTIONS,
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
  const [showPicker, setShowPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

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

  // Close picker on click outside
  useEffect(() => {
    if (!showPicker) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

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
        setShowPicker(false);
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

      {/* Add Reaction Button */}
      {userId && (
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker(!showPicker)}
            disabled={isLoading}
            className={`
              flex items-center justify-center w-7 h-7 rounded-full
              transition-all duration-200
              bg-atlas-pearl/80 border border-atlas-border
              hover:bg-atlas-sand/20
              ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            title="Add reaction"
            aria-label="Add reaction"
          >
            {showPicker ? (
              <Plus className="w-3.5 h-3.5 text-atlas-text-medium rotate-45" />
            ) : (
              <Smile className="w-3.5 h-3.5 text-atlas-text-medium" />
            )}
          </button>

          {/* Reaction Picker */}
          <AnimatePresence>
            {showPicker && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-lg border border-atlas-border p-2 flex gap-1 z-50"
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReactionClick(emoji)}
                    disabled={isLoading}
                    className={`
                      w-8 h-8 flex items-center justify-center rounded-lg
                      text-lg transition-all duration-150
                      hover:bg-atlas-sage/20 hover:scale-110
                      ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}


