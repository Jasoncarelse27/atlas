/**
 * Streak Service
 * Handles streak freeze logic and tier enforcement
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import { differenceInDays, format } from 'date-fns';

export class StreakService {
  /**
   * Check if user can use streak freeze
   * Core/Studio feature only, once per month
   */
  async canUseStreakFreeze(userId: string): Promise<boolean> {
    try {
      // Get user's tier
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, streak_freeze_used_at')
        .eq('id', userId)
        .single() as { data: { subscription_tier?: string; streak_freeze_used_at?: string | null } | null };

      if (!profile) return false;

      // Free tier can't use streak freeze
      if (profile.subscription_tier === 'free') {
        return false;
      }

      // Check if already used this month
      if (profile.streak_freeze_used_at) {
        const lastUsed = new Date(profile.streak_freeze_used_at);
        const now = new Date();
        
        // Can only use once per calendar month
        if (lastUsed.getMonth() === now.getMonth() && 
            lastUsed.getFullYear() === now.getFullYear()) {
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('[StreakService] Failed to check streak freeze eligibility:', error);
      return false;
    }
  }

  /**
   * Use streak freeze to prevent streak loss
   */
  async useStreakFreeze(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check eligibility
      const canUse = await this.canUseStreakFreeze(userId);
      if (!canUse) {
        return {
          success: false,
          message: 'Streak freeze not available (Free tier or already used this month)',
        };
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ streak_freeze_used_at: new Date().toISOString() } as any)
        .eq('id', userId);

      if (error) throw error;

      return {
        success: true,
        message: 'Streak freeze activated! Your streak is protected today.',
      };
    } catch (error) {
      logger.error('[StreakService] Failed to use streak freeze:', error);
      return {
        success: false,
        message: 'Failed to activate streak freeze. Please try again.',
      };
    }
  }

  /**
   * Calculate streak with freeze consideration
   */
  async calculateStreakWithFreeze(userId: string, logs: any[]): Promise<{
    currentStreak: number;
    frozenToday: boolean;
  }> {
    if (!logs || logs.length === 0) {
      return { currentStreak: 0, frozenToday: false };
    }

    // Get streak freeze status
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak_freeze_used_at')
      .eq('id', userId)
      .single() as { data: { streak_freeze_used_at?: string | null } | null };

    const frozenToday = profile?.streak_freeze_used_at && 
      format(new Date(profile.streak_freeze_used_at), 'yyyy-MM-dd') === 
      format(new Date(), 'yyyy-MM-dd');

    // Get unique completion dates
    const uniqueDates = Array.from(
      new Set(logs.map(log => format(new Date(log.completed_at), 'yyyy-MM-dd')))
    ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let currentStreak = 0;
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

    // Check if streak is active (completed today, yesterday, or frozen today)
    if (uniqueDates[0] === today || uniqueDates[0] === yesterday || frozenToday) {
      currentStreak = 1;
      
      // Count consecutive days
      let checkDate = uniqueDates[0] === today ? yesterday : uniqueDates[0];
      
      for (let i = uniqueDates[0] === today ? 1 : 0; i < uniqueDates.length; i++) {
        const completionDate = uniqueDates[i];
        const daysDiff = Math.abs(differenceInDays(
          new Date(checkDate),
          new Date(completionDate)
        ));
        
        if (daysDiff <= 1) {
          currentStreak++;
          checkDate = completionDate;
        } else {
          // Check if there was a freeze on the gap day
          const gapDate = new Date(checkDate);
          gapDate.setDate(gapDate.getDate() - 1);
          const gapDateStr = format(gapDate, 'yyyy-MM-dd');
          
          if (profile?.streak_freeze_used_at && 
              format(new Date(profile.streak_freeze_used_at), 'yyyy-MM-dd') === gapDateStr) {
            // Freeze was used, continue streak
            currentStreak++;
            checkDate = completionDate;
          } else {
            break;
          }
        }
      }
    }

    return { currentStreak, frozenToday };
  }
}

export const streakService = new StreakService();
