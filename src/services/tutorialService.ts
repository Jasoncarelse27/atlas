/**
 * Tutorial Service
 * Handles tutorial completion tracking and sync between localStorage and database
 * Follows Atlas sync patterns: localStorage → Supabase
 */

import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';

const TUTORIAL_STORAGE_KEY = 'atlas:tutorial_completed';

export interface TutorialCompletionStatus {
  isCompleted: boolean;
  completedAt: string | null;
  source: 'localStorage' | 'database' | 'both';
}

/**
 * Check if tutorial is completed (checks both localStorage and database)
 * Follows Atlas sync pattern: localStorage first (fast), then database (cross-device)
 */
export async function checkTutorialCompletion(userId: string | null): Promise<TutorialCompletionStatus> {
  if (!userId) {
    // No user - check localStorage only (for offline support)
    const localCompleted = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    return {
      isCompleted: localCompleted === 'true',
      completedAt: localCompleted || null,
      source: 'localStorage'
    };
  }

  // Check localStorage first (fast, offline support)
  const localCompleted = localStorage.getItem(TUTORIAL_STORAGE_KEY);
  
  try {
    // Check database (cross-device sync)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('tutorial_completed_at')
      .eq('id', userId)
      .single();

    if (error) {
      logger.warn('[TutorialService] Failed to fetch tutorial status from database:', error);
      // Fallback to localStorage
      return {
        isCompleted: localCompleted === 'true',
        completedAt: localCompleted || null,
        source: 'localStorage'
      };
    }

    const dbCompleted = profile?.tutorial_completed_at;

    // If either shows completion, tutorial is completed
    const isCompleted = localCompleted === 'true' || !!dbCompleted;

    // Determine source
    let source: 'localStorage' | 'database' | 'both' = 'localStorage';
    if (localCompleted === 'true' && dbCompleted) {
      source = 'both';
    } else if (dbCompleted && localCompleted !== 'true') {
      source = 'database';
    }

    // Sync localStorage if database has completion but localStorage doesn't
    if (dbCompleted && localCompleted !== 'true') {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, dbCompleted);
      logger.debug('[TutorialService] Synced tutorial completion from database to localStorage');
    }

    return {
      isCompleted,
      completedAt: dbCompleted || localCompleted || null,
      source
    };
  } catch (error) {
    logger.error('[TutorialService] Error checking tutorial completion:', error);
    // Fallback to localStorage
    return {
      isCompleted: localCompleted === 'true',
      completedAt: localCompleted || null,
      source: 'localStorage'
    };
  }
}

/**
 * Mark tutorial as completed (updates both localStorage and database atomically)
 * Follows Atlas sync pattern: update both for cross-device sync
 */
export async function markTutorialCompleted(userId: string | null): Promise<void> {
  const completedAt = new Date().toISOString();

  // Update localStorage immediately (fast, offline support)
  localStorage.setItem(TUTORIAL_STORAGE_KEY, completedAt);
  logger.debug('[TutorialService] Tutorial completion saved to localStorage');

  if (!userId) {
    logger.warn('[TutorialService] No userId - tutorial completion saved to localStorage only');
    return;
  }

  try {
    // Update database (cross-device sync)
    const { error } = await supabase
      .from('profiles')
      .update({ tutorial_completed_at: completedAt })
      .eq('id', userId);

    if (error) {
      logger.error('[TutorialService] Failed to save tutorial completion to database:', error);
      // localStorage is already updated, so user won't see tutorial again
      // Database sync will happen on next check
      throw error;
    }

    logger.debug('[TutorialService] Tutorial completion saved to database');
  } catch (error) {
    logger.error('[TutorialService] Error marking tutorial as completed:', error);
    // Don't throw - localStorage is updated, so tutorial won't show again
    // Database sync will happen on next check
  }
}

/**
 * Reset tutorial completion (for testing/admin purposes)
 */
export async function resetTutorialCompletion(userId: string | null): Promise<void> {
  localStorage.removeItem(TUTORIAL_STORAGE_KEY);

  if (userId) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ tutorial_completed_at: null })
        .eq('id', userId);

      if (error) {
        logger.error('[TutorialService] Failed to reset tutorial completion:', error);
      }
    } catch (error) {
      logger.error('[TutorialService] Error resetting tutorial completion:', error);
    }
  }
}

