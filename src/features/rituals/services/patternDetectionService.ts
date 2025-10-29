/**
 * Pattern Detection Service
 * Analyzes ritual completion patterns for personalized insights
 */

import { supabase } from '@/lib/supabaseClient';

export interface RitualPattern {
  type: 'time_of_day' | 'day_of_week' | 'ritual_type' | 'mood_improvement';
  title: string;
  insight: string;
  data: any;
  confidence: number; // 0-1
}

export class PatternDetectionService {
  /**
   * Detect all patterns for a user
   */
  async detectPatterns(userId: string): Promise<RitualPattern[]> {
    const patterns: RitualPattern[] = [];

    // Get ritual logs with computed hour/day columns
    const { data: logs, error } = await supabase
      .from('ritual_logs')
      .select(`
        id,
        ritual_id,
        completed_at,
        mood_before,
        mood_after,
        rituals (
          id,
          title,
          goal
        )
      `)
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(100);

    if (error || !logs || logs.length < 5) {
      return patterns; // Need at least 5 completions for patterns
    }

    // Time of Day Pattern
    const timePattern = this.detectTimeOfDayPattern(logs);
    if (timePattern) patterns.push(timePattern);

    // Day of Week Pattern
    const dayPattern = this.detectDayOfWeekPattern(logs);
    if (dayPattern) patterns.push(dayPattern);

    // Ritual Type Pattern
    const typePattern = this.detectRitualTypePattern(logs);
    if (typePattern) patterns.push(typePattern);

    // Mood Improvement Pattern
    const moodPattern = this.detectMoodImprovementPattern(logs);
    if (moodPattern) patterns.push(moodPattern);

    return patterns;
  }

  /**
   * Detect when user most often completes rituals
   */
  private detectTimeOfDayPattern(logs: any[]): RitualPattern | null {
    // Group by hour (calculated from completed_at)
    const hourCounts: Record<number, number> = {};
    logs.forEach((log: any) => {
      const hour = new Date(log.completed_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Find peak hours
    const sortedHours = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a);

    if (sortedHours.length === 0) return null;

    const [peakHour, count] = sortedHours[0];
    const percentage = Math.round((count / logs.length) * 100);

    if (percentage < 30) return null; // Not significant enough

    // Generate insight
    const hour = parseInt(peakHour);
    let timeOfDay = '';
    let emoji = '';

    if (hour >= 5 && hour < 9) {
      timeOfDay = 'morning';
      emoji = '🌅';
    } else if (hour >= 9 && hour < 12) {
      timeOfDay = 'mid-morning';
      emoji = '☀️';
    } else if (hour >= 12 && hour < 17) {
      timeOfDay = 'afternoon';
      emoji = '🌤️';
    } else if (hour >= 17 && hour < 21) {
      timeOfDay = 'evening';
      emoji = '🌆';
    } else {
      timeOfDay = 'night';
      emoji = '🌙';
    }

    return {
      type: 'time_of_day',
      title: `You're a ${timeOfDay} person ${emoji}`,
      insight: `${percentage}% of your rituals happen between ${hour}:00-${hour + 1}:00. Your body naturally seeks mindfulness at this time.`,
      data: { peakHour: hour, percentage },
      confidence: percentage / 100,
    };
  }

  /**
   * Detect which days user is most consistent
   */
  private detectDayOfWeekPattern(logs: any[]): RitualPattern | null {
    const dayCounts: Record<number, number> = {};

    logs.forEach((log: any) => {
      const dow = log.day_of_week;
      dayCounts[dow] = (dayCounts[dow] || 0) + 1;
    });

    const sortedDays = Object.entries(dayCounts)
      .sort(([, a], [, b]) => b - a);

    if (sortedDays.length < 3) return null;

    // Check for weekday vs weekend pattern
    const weekdayCount = [1, 2, 3, 4, 5].reduce((sum, day) => sum + (dayCounts[day] || 0), 0);
    const weekendCount = [0, 6].reduce((sum, day) => sum + (dayCounts[day] || 0), 0);
    const weekdayAvg = weekdayCount / 5;
    const weekendAvg = weekendCount / 2;

    if (weekdayAvg > weekendAvg * 1.5) {
      const percentage = Math.round((weekdayCount / logs.length) * 100);
      return {
        type: 'day_of_week',
        title: 'Weekday warrior 💼',
        insight: `${percentage}% of your rituals happen on weekdays. You thrive on routine and structure!`,
        data: { pattern: 'weekday', percentage },
        confidence: 0.7,
      };
    }

    if (weekendAvg > weekdayAvg * 1.5) {
      const percentage = Math.round((weekendCount / logs.length) * 100);
      return {
        type: 'day_of_week',
        title: 'Weekend wellness 🌴',
        insight: `${percentage}% of your rituals happen on weekends. You use free time for self-care!`,
        data: { pattern: 'weekend', percentage },
        confidence: 0.7,
      };
    }

    return null;
  }

  /**
   * Detect which ritual types user prefers
   */
  private detectRitualTypePattern(logs: any[]): RitualPattern | null {
    const goalCounts: Record<string, number> = {};
    
    logs.forEach((log: any) => {
      if (log.rituals?.goal) {
        const goal = log.rituals.goal;
        goalCounts[goal] = (goalCounts[goal] || 0) + 1;
      }
    });

    const sortedGoals = Object.entries(goalCounts)
      .sort(([, a], [, b]) => b - a);

    if (sortedGoals.length === 0) return null;

    const [topGoal, count] = sortedGoals[0];
    const percentage = Math.round((count / logs.length) * 100);

    if (percentage < 35) return null; // Not dominant enough

    const insights: Record<string, { emoji: string; insight: string }> = {
      energy: {
        emoji: '⚡',
        insight: 'You prioritize energizing practices. Consider morning rituals for maximum impact.',
      },
      calm: {
        emoji: '🧘',
        insight: 'You seek tranquility. Evening calm rituals can improve your sleep quality.',
      },
      focus: {
        emoji: '🎯',
        insight: 'You value mental clarity. Try focus rituals before important tasks.',
      },
      creativity: {
        emoji: '✨',
        insight: 'You nurture your creative side. Creativity rituals work best when you feel relaxed.',
      },
    };

    const { emoji, insight } = insights[topGoal] || { emoji: '🌟', insight: '' };

    return {
      type: 'ritual_type',
      title: `${topGoal.charAt(0).toUpperCase() + topGoal.slice(1)} seeker ${emoji}`,
      insight: `${percentage}% of your rituals focus on ${topGoal}. ${insight}`,
      data: { topGoal, percentage },
      confidence: percentage / 100,
    };
  }

  /**
   * Detect which rituals improve mood most
   */
  private detectMoodImprovementPattern(logs: any[]): RitualPattern | null {
    const moodValues: Record<string, number> = {
      '😰': 1, // stressed
      '😔': 2, // sad  
      '😐': 3, // neutral
      '🙂': 4, // happy
      '😌': 5, // calm
      '😊': 6, // joyful
    };

    // Calculate improvement by ritual
    const ritualImprovements: Record<string, { total: number; count: number; title: string }> = {};

    logs.forEach((log: any) => {
      if (log.mood_before && log.mood_after && log.rituals) {
        const improvement = (moodValues[log.mood_after] || 3) - (moodValues[log.mood_before] || 3);
        const ritualId = log.ritual_id;
        
        if (!ritualImprovements[ritualId]) {
          ritualImprovements[ritualId] = {
            total: 0,
            count: 0,
            title: log.rituals?.title || 'Unknown',
          };
        }
        
        ritualImprovements[ritualId].total += improvement;
        ritualImprovements[ritualId].count++;
      }
    });

    // Find ritual with best average improvement
    let bestRitual = null;
    let bestImprovement = 0;

    Object.entries(ritualImprovements).forEach(([ritualId, data]) => {
      const avgImprovement = data.total / data.count;
      if (avgImprovement > bestImprovement && data.count >= 3) {
        bestRitual = { id: ritualId, ...data, avgImprovement };
        bestImprovement = avgImprovement;
      }
    });

    if (!bestRitual || bestImprovement < 0.5) return null;

    const improvementPercent = Math.round(bestImprovement * 33); // Convert to percentage

    return {
      type: 'mood_improvement',
      title: 'Mood booster found 🎉',
      insight: `"${bestRitual.title}" improves your mood by ${improvementPercent}% on average. Use it when you need a pick-me-up!`,
      data: { ritualId: bestRitual.id, title: bestRitual.title, improvement: bestImprovement },
      confidence: Math.min(bestImprovement / 2, 1),
    };
  }
}

export const patternDetectionService = new PatternDetectionService();
