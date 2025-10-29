/**
 * Ritual Analytics Service
 * Aggregates ritual completion data for insights dashboard
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import { differenceInDays, endOfDay, format, startOfDay, subDays } from 'date-fns';

export interface CompletionStats {
  totalCompletions: number;
  completionsByRitual: Record<string, { ritualTitle: string; count: number }>;
  completionsByGoal: Record<string, number>;
  averageDuration: number;
}

export interface MoodTrend {
  date: string;
  avgMoodBefore: number;
  avgMoodAfter: number;
  improvement: number;
  completions: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCompletionDate: string | null;
}

// Mood value mapping
const MOOD_VALUES: Record<string, number> = {
  '😰': 1, // stressed
  '😔': 2, // sad
  '😐': 3, // neutral  
  '🙂': 4, // happy
  '😌': 5, // calm
  '😊': 6, // joyful
};

class RitualAnalyticsService {
  /**
   * Get ritual completion statistics for a user
   */
  async getRitualCompletionStats(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<CompletionStats> {
    try {
      const { data: logs, error } = await supabase
        .from('ritual_logs')
        .select(`
          id,
          ritual_id,
          duration_seconds,
          rituals (
            id,
            title,
            goal
          )
        `)
        .eq('user_id', userId)
        .gte('completed_at', dateRange.start.toISOString())
        .lte('completed_at', dateRange.end.toISOString())
        .order('completed_at', { ascending: false })
        .limit(100); // ✅ Performance: Limit to most recent 100 logs

      if (error) throw error;

      const totalCompletions = logs?.length || 0;
      const completionsByRitual: Record<string, { ritualTitle: string; count: number }> = {};
      const completionsByGoal: Record<string, number> = {
        energy: 0,
        calm: 0,
        focus: 0,
        creativity: 0,
      };
      let totalDuration = 0;

      logs?.forEach((log: any) => {
        const ritual = log.rituals;
        if (ritual) {
          // Count by ritual
          if (!completionsByRitual[ritual.id]) {
            completionsByRitual[ritual.id] = {
              ritualTitle: ritual.title,
              count: 0,
            };
          }
          completionsByRitual[ritual.id].count++;

          // Count by goal
          if (ritual.goal in completionsByGoal) {
            completionsByGoal[ritual.goal]++;
          }
        }

        totalDuration += log.duration_seconds || 0;
      });

      return {
        totalCompletions,
        completionsByRitual,
        completionsByGoal,
        averageDuration: totalCompletions > 0 ? Math.round(totalDuration / totalCompletions) : 0,
      };
    } catch (error) {
      logger.error('[RitualAnalytics] Failed to get completion stats:', error);
      return {
        totalCompletions: 0,
        completionsByRitual: {},
        completionsByGoal: { energy: 0, calm: 0, focus: 0, creativity: 0 },
        averageDuration: 0,
      };
    }
  }

  /**
   * Get mood trends over time
   */
  async getMoodTrends(
    userId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<MoodTrend[]> {
    try {
      const { data: logs, error } = await supabase
        .from('ritual_logs')
        .select('completed_at, mood_before, mood_after')
        .eq('user_id', userId)
        .gte('completed_at', dateRange.start.toISOString())
        .lte('completed_at', dateRange.end.toISOString())
        .order('completed_at', { ascending: true })
        .limit(100); // ✅ Performance: Limit to most recent 100 logs

      if (error) throw error;

      // Group by date
      const trendsByDate: Record<string, {
        moodsBefore: number[];
        moodsAfter: number[];
      }> = {};

      logs?.forEach((log: any) => {
        const date = format(new Date(log.completed_at), 'yyyy-MM-dd');
        
        if (!trendsByDate[date]) {
          trendsByDate[date] = {
            moodsBefore: [],
            moodsAfter: [],
          };
        }

        const moodBeforeValue = MOOD_VALUES[log.mood_before] || 3;
        const moodAfterValue = MOOD_VALUES[log.mood_after] || 3;

        trendsByDate[date].moodsBefore.push(moodBeforeValue);
        trendsByDate[date].moodsAfter.push(moodAfterValue);
      });

      // Calculate averages per day
      const trends: MoodTrend[] = Object.entries(trendsByDate).map(([date, data]) => {
        const avgBefore = data.moodsBefore.reduce((a, b) => a + b, 0) / data.moodsBefore.length;
        const avgAfter = data.moodsAfter.reduce((a, b) => a + b, 0) / data.moodsAfter.length;

        return {
          date,
          avgMoodBefore: parseFloat(avgBefore.toFixed(2)),
          avgMoodAfter: parseFloat(avgAfter.toFixed(2)),
          improvement: parseFloat((avgAfter - avgBefore).toFixed(2)),
          completions: data.moodsBefore.length,
        };
      });

      return trends;
    } catch (error) {
      logger.error('[RitualAnalytics] Failed to get mood trends:', error);
      return [];
    }
  }

  /**
   * Calculate streak data (current and longest)
   */
  async getStreakData(userId: string): Promise<StreakData> {
    try {
      const { data: logs, error } = await supabase
        .from('ritual_logs')
        .select('completed_at')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });

      if (error) throw error;

      if (!logs || logs.length === 0) {
        return {
          currentStreak: 0,
          longestStreak: 0,
          lastCompletionDate: null,
        };
      }

      // Get unique completion dates
      const completionDates = Array.from(
        new Set(logs.map((log: any) => format(new Date(log.completed_at), 'yyyy-MM-dd')))
      ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      // Calculate current streak
      let currentStreak = 0;
      const today = format(new Date(), 'yyyy-MM-dd');
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

      if (completionDates[0] === today || completionDates[0] === yesterday) {
        currentStreak = 1;

        for (let i = 1; i < completionDates.length; i++) {
          const currentDate = new Date(completionDates[i]);
          const prevDate = new Date(completionDates[i - 1]);
          
          const daysDiff = differenceInDays(prevDate, currentDate);

          if (daysDiff === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      // Calculate longest streak
      let longestStreak = 0;
      let tempStreak = 1;

      for (let i = 1; i < completionDates.length; i++) {
        const currentDate = new Date(completionDates[i]);
        const prevDate = new Date(completionDates[i - 1]);
        
        const daysDiff = differenceInDays(prevDate, currentDate);

        if (daysDiff === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);

      return {
        currentStreak,
        longestStreak,
        lastCompletionDate: (logs[0] as any).completed_at,
      };
    } catch (error) {
      logger.error('[RitualAnalytics] Failed to get streak data:', error);
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastCompletionDate: null,
      };
    }
  }

  /**
   * Get average mood improvement
   */
  async getAverageMoodImprovement(userId: string, days: number = 30): Promise<number> {
    try {
      const startDate = startOfDay(subDays(new Date(), days));
      const endDate = endOfDay(new Date());

      const { data: logs, error } = await supabase
        .from('ritual_logs')
        .select('mood_before, mood_after')
        .eq('user_id', userId)
        .gte('completed_at', startDate.toISOString())
        .lte('completed_at', endDate.toISOString())
        .limit(100); // ✅ Performance: Limit to most recent 100 logs

      if (error) throw error;

      if (!logs || logs.length === 0) return 0;

      const improvements = logs.map((log: any) => {
        const before = MOOD_VALUES[log.mood_before] || 3;
        const after = MOOD_VALUES[log.mood_after] || 3;
        return after - before;
      });

      const avgImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;
      return parseFloat(avgImprovement.toFixed(2));
    } catch (error) {
      logger.error('[RitualAnalytics] Failed to get average mood improvement:', error);
      return 0;
    }
  }

  /**
   * Get completions by goal
   */
  async getCompletionsByGoal(userId: string, days: number = 30): Promise<Record<string, number>> {
    const startDate = startOfDay(subDays(new Date(), days));
    const endDate = endOfDay(new Date());

    const stats = await this.getRitualCompletionStats(userId, {
      start: startDate,
      end: endDate,
    });

    return stats.completionsByGoal;
  }

  /**
   * Get most completed ritual
   */
  async getMostCompletedRitual(userId: string, days: number = 30): Promise<{ title: string; count: number } | null> {
    const startDate = startOfDay(subDays(new Date(), days));
    const endDate = endOfDay(new Date());

    const stats = await this.getRitualCompletionStats(userId, {
      start: startDate,
      end: endDate,
    });

    let maxCount = 0;
    let topRitual: { title: string; count: number } | null = null;

    Object.values(stats.completionsByRitual).forEach((ritual) => {
      if (ritual.count > maxCount) {
        maxCount = ritual.count;
        topRitual = { title: ritual.ritualTitle, count: ritual.count };
      }
    });

    return topRitual;
  }
}

export const ritualAnalyticsService = new RitualAnalyticsService();

