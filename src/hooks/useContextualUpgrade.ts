/**
 * Contextual Upgrade Prompts Hook
 * Shows upgrade prompts based on user behavior and engagement
 * 
 * Triggers:
 * - After 3 ritual completions (free tier only)
 * - After viewing locked ritual (enhanced CTA)
 * - After chat ritual suggestion (context-aware)
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTierQuery } from './useTierQuery';
import { useUpgradeModals } from '../contexts/UpgradeModalContext';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';
import { getDisplayPrice } from '../config/pricing';

interface UseContextualUpgradeReturn {
  checkAndShowCompletionPrompt: (completionCount: number) => void;
  showLockedRitualPrompt: (ritualTitle: string, tierRequired: 'core' | 'studio') => void;
  showChatRitualPrompt: (ritualTitle: string) => void;
  getCompletionCount: () => Promise<number>;
}

const COMPLETION_PROMPT_THRESHOLD = 3; // Show upgrade prompt after 3 completions
const COMPLETION_PROMPT_SHOWN_KEY = 'atlas_completion_prompt_shown';

export function useContextualUpgrade(): UseContextualUpgradeReturn {
  const { tier, userId } = useTierQuery();
  const { showGenericUpgrade } = useUpgradeModals();
  const [hasShownCompletionPrompt, setHasShownCompletionPrompt] = useState(false);

  // Check if we've already shown the completion prompt (persist across sessions)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const shown = localStorage.getItem(COMPLETION_PROMPT_SHOWN_KEY) === 'true';
      setHasShownCompletionPrompt(shown);
    }
  }, []);

  /**
   * Get total ritual completion count for current user
   */
  const getCompletionCount = useCallback(async (): Promise<number> => {
    if (!userId) return 0;

    try {
      const { count, error } = await supabase
        .from('ritual_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      logger.error('[useContextualUpgrade] Failed to get completion count:', error);
      return 0;
    }
  }, [userId]);

  /**
   * Check completion count and show upgrade prompt if threshold reached
   * Only shows once per user (tracked in localStorage)
   */
  const checkAndShowCompletionPrompt = useCallback(async (completionCount: number) => {
    // Only show for free tier users
    if (tier !== 'free') return;

    // Only show if threshold reached and not already shown
    if (completionCount < COMPLETION_PROMPT_THRESHOLD || hasShownCompletionPrompt) return;

    // Mark as shown
    setHasShownCompletionPrompt(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(COMPLETION_PROMPT_SHOWN_KEY, 'true');
    }

    // Show contextual upgrade toast with action
    toast.success(
      `🎉 You've completed ${completionCount} rituals!`,
      {
        description: `Unlock unlimited rituals and advanced features with Core (${getDisplayPrice('core')})`,
        duration: 6000,
        action: {
          label: 'Upgrade Now',
          onClick: () => showGenericUpgrade('rituals'),
        },
      }
    );

    logger.info('[useContextualUpgrade] Shown completion prompt after', completionCount, 'completions');
  }, [tier, hasShownCompletionPrompt, showGenericUpgrade]);

  /**
   * Show enhanced upgrade prompt after viewing locked ritual
   */
  const showLockedRitualPrompt = useCallback((ritualTitle: string, tierRequired: 'core' | 'studio') => {
    if (tier !== 'free') return; // Only for free tier

    // Show contextual toast with ritual-specific messaging
    toast.info(
      `🔒 "${ritualTitle}" is perfect for you!`,
      {
        description: `Unlock this ritual and ${tierRequired === 'core' ? 'unlimited chat' : 'advanced features'} with ${tierRequired === 'core' ? 'Core' : 'Studio'} (${getDisplayPrice(tierRequired)})`,
        duration: 5000,
        action: {
          label: 'Upgrade',
          onClick: () => showGenericUpgrade('rituals'),
        },
      }
    );
  }, [tier, showGenericUpgrade]);

  /**
   * Show upgrade prompt when chat suggests a ritual
   */
  const showChatRitualPrompt = useCallback((ritualTitle: string) => {
    if (tier !== 'free') return; // Only for free tier

    toast.info(
      `✨ Try "${ritualTitle}" now!`,
      {
        description: `Upgrade to Core (${getDisplayPrice('core')}) to access this ritual and unlock unlimited chat`,
        duration: 5000,
        action: {
          label: 'Upgrade',
          onClick: () => showGenericUpgrade('rituals'),
        },
      }
    );
  }, [tier, showGenericUpgrade]);

  return {
    checkAndShowCompletionPrompt,
    showLockedRitualPrompt,
    showChatRitualPrompt,
    getCompletionCount,
  };
}

