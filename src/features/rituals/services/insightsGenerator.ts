/**
 * Insights Generator
 * Generates personalized insights from ritual completion data
 */

import { logger } from '@/lib/logger';
import { endOfDay, startOfDay, subDays } from 'date-fns';
import type { PersonalInsight } from '../types/rituals';
import { ritualAnalyticsService } from './ritualAnalyticsService';

class InsightsGenerator {
  /**
   * Generate all personal insights for a user
   */
  async generateInsights(userId: string): Promise<PersonalInsight[]> {
    try {
      const insights: PersonalInsight[] = [];

      // Get data for analysis
      const [moodInsight, consistencyInsight, preferenceInsight, achievementInsight] = await Promise.all([
        this.generateMoodInsight(userId),
        this.generateConsistencyInsight(userId),
        this.generatePreferenceInsight(userId),
        this.generateAchievementInsight(userId),
      ]);

      if (moodInsight) insights.push(moodInsight);
      if (consistencyInsight) insights.push(consistencyInsight);
      if (preferenceInsight) insights.push(preferenceInsight);
      if (achievementInsight) insights.push(achievementInsight);

      return insights;
    } catch (error) {
      logger.error('[InsightsGenerator] Failed to generate insights:', error);
      return [];
    }
  }

  /**
   * Generate mood improvement insight
   */
  private async generateMoodInsight(userId: string): Promise<PersonalInsight | null> {
    try {
      const avgImprovement = await ritualAnalyticsService.getAverageMoodImprovement(userId, 30);

      if (avgImprovement === 0) return null;

      const percentage = Math.round(Math.abs(avgImprovement) * 20); // Convert to rough percentage

      if (avgImprovement > 0) {
        if (avgImprovement >= 1.5) {
          return {
            type: 'mood',
            message: `Your rituals boost your mood by ${percentage}% on average`,
            icon: '🎉',
            value: avgImprovement,
          };
        } else if (avgImprovement >= 0.5) {
          return {
            type: 'mood',
            message: `You feel ${percentage}% better after completing rituals`,
            icon: '😌',
            value: avgImprovement,
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('[InsightsGenerator] Failed to generate mood insight:', error);
      return null;
    }
  }

  /**
   * Generate consistency insight
   */
  private async generateConsistencyInsight(userId: string): Promise<PersonalInsight | null> {
    try {
      const streakData = await ritualAnalyticsService.getStreakData(userId);

      if (streakData.currentStreak === 0) return null;

      if (streakData.currentStreak >= 7) {
        return {
          type: 'consistency',
          message: `🔥 ${streakData.currentStreak} day streak! You're building powerful habits`,
          icon: '🔥',
          value: streakData.currentStreak,
        };
      } else if (streakData.currentStreak >= 3) {
        return {
          type: 'consistency',
          message: `Keep going! You're on a ${streakData.currentStreak} day streak`,
          icon: '💪',
          value: streakData.currentStreak,
        };
      }

      return null;
    } catch (error) {
      logger.error('[InsightsGenerator] Failed to generate consistency insight:', error);
      return null;
    }
  }

  /**
   * Generate preference insight (best time/ritual)
   */
  private async generatePreferenceInsight(userId: string): Promise<PersonalInsight | null> {
    try {
      const topRitual = await ritualAnalyticsService.getMostCompletedRitual(userId, 30);

      if (!topRitual || topRitual.count < 3) return null;

      return {
        type: 'preference',
        message: `"${topRitual.title}" is your go-to ritual (${topRitual.count} times this month)`,
        icon: '⭐',
        value: topRitual.count,
      };
    } catch (error) {
      logger.error('[InsightsGenerator] Failed to generate preference insight:', error);
      return null;
    }
  }

  /**
   * Generate achievement insight
   */
  private async generateAchievementInsight(userId: string): Promise<PersonalInsight | null> {
    try {
      const startDate = startOfDay(subDays(new Date(), 30));
      const endDate = endOfDay(new Date());

      const stats = await ritualAnalyticsService.getRitualCompletionStats(userId, {
        start: startDate,
        end: endDate,
      });

      if (stats.totalCompletions === 0) return null;

      if (stats.totalCompletions >= 30) {
        return {
          type: 'achievement',
          message: `🏆 ${stats.totalCompletions} rituals completed this month! Incredible dedication`,
          icon: '🏆',
          value: stats.totalCompletions,
        };
      } else if (stats.totalCompletions >= 15) {
        return {
          type: 'achievement',
          message: `Great progress! ${stats.totalCompletions} rituals completed this month`,
          icon: '🎯',
          value: stats.totalCompletions,
        };
      } else if (stats.totalCompletions >= 5) {
        return {
          type: 'achievement',
          message: `You're building momentum with ${stats.totalCompletions} completions`,
          icon: '✨',
          value: stats.totalCompletions,
        };
      }

      return null;
    } catch (error) {
      logger.error('[InsightsGenerator] Failed to generate achievement insight:', error);
      return null;
    }
  }

  /**
   * Generate goal-specific insight
   */
  async generateGoalInsight(userId: string): Promise<PersonalInsight | null> {
    try {
      const completionsByGoal = await ritualAnalyticsService.getCompletionsByGoal(userId, 30);

      const goals = Object.entries(completionsByGoal).sort((a, b) => b[1] - a[1]);

      if (goals[0] && goals[0][1] >= 5) {
        const goalName = goals[0][0];
        const count = goals[0][1];

        const goalMessages: Record<string, string> = {
          energy: `Your energy rituals are working! ${count} sessions focused on vitality`,
          calm: `Finding peace through practice. ${count} calming rituals completed`,
          focus: `Deep work champion! ${count} focus rituals this month`,
          creativity: `Creative flow unlocked with ${count} rituals`,
        };

        const goalIcons: Record<string, string> = {
          energy: '⚡',
          calm: '🧘',
          focus: '🎯',
          creativity: '🎨',
        };

        return {
          type: 'preference',
          message: goalMessages[goalName] || '',
          icon: goalIcons[goalName] || '✨',
          value: count,
        };
      }

      return null;
    } catch (error) {
      logger.error('[InsightsGenerator] Failed to generate goal insight:', error);
      return null;
    }
  }
}

export const insightsGenerator = new InsightsGenerator();

