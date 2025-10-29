/**
 * Streak Prediction Component
 * Shows motivational messages about current streak progress
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import { useTierQuery } from '@/hooks/useTierQuery';
import { differenceInDays, format } from 'date-fns';
import { Flame, Trophy, TrendingUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface StreakInfo {
  currentStreak: number;
  targetStreak: number;
  daysToTarget: number;
  message: string;
  icon: 'flame' | 'trophy' | 'trending';
}

const STREAK_MILESTONES = [7, 14, 30, 50, 100];

export const StreakPrediction: React.FC = () => {
  const { userId } = useTierQuery();
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStreakData = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        // Get current streak from analytics service
        const { data: logs } = await supabase
          .from('ritual_logs')
          .select('completed_at')
          .eq('user_id', userId)
          .order('completed_at', { ascending: false })
          .limit(100);

        if (!logs || logs.length === 0) {
          setStreakInfo({
            currentStreak: 0,
            targetStreak: STREAK_MILESTONES[0],
            daysToTarget: STREAK_MILESTONES[0],
            message: 'Start your first ritual to begin your streak!',
            icon: 'flame',
          });
          return;
        }

        // Calculate current streak
        const uniqueDates = Array.from(
          new Set(logs.map((log: any) => format(new Date(log.completed_at), 'yyyy-MM-dd')))
        ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        let currentStreak = 0;
        const today = format(new Date(), 'yyyy-MM-dd');
        const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

        if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
          currentStreak = 1;
          
          for (let i = 1; i < uniqueDates.length; i++) {
            const prevDate = new Date(uniqueDates[i - 1]);
            const currDate = new Date(uniqueDates[i]);
            const daysDiff = differenceInDays(prevDate, currDate);
            
            if (daysDiff === 1) {
              currentStreak++;
            } else {
              break;
            }
          }
        }

        // Find next milestone
        const nextMilestone = STREAK_MILESTONES.find(m => m > currentStreak) || 365;
        const daysToTarget = nextMilestone - currentStreak;

        // Generate motivational message
        let message = '';
        let icon: StreakInfo['icon'] = 'flame';

        if (currentStreak === 0) {
          message = 'Start your ritual journey today!';
          icon = 'flame';
        } else if (daysToTarget === 1) {
          message = `Just 1 more day to reach your ${nextMilestone}-day milestone! 🎯`;
          icon = 'trophy';
        } else if (daysToTarget <= 3) {
          message = `${daysToTarget} days to ${nextMilestone}-day streak! Keep going! 💪`;
          icon = 'trending';
        } else if (currentStreak >= 30) {
          message = `Amazing ${currentStreak}-day streak! You're unstoppable! 🚀`;
          icon = 'trophy';
        } else if (currentStreak >= 7) {
          message = `${currentStreak}-day streak! ${daysToTarget} days to ${nextMilestone} 🔥`;
          icon = 'flame';
        } else {
          message = `${currentStreak}-day streak started! Build momentum! ⚡`;
          icon = 'flame';
        }

        setStreakInfo({
          currentStreak,
          targetStreak: nextMilestone,
          daysToTarget,
          message,
          icon,
        });
      } catch (error) {
        logger.error('[StreakPrediction] Failed to fetch streak data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStreakData();
  }, [userId]);

  if (loading || !streakInfo || streakInfo.currentStreak === 0) {
    return null; // Don't show if no streak
  }

  const Icon = {
    flame: Flame,
    trophy: Trophy,
    trending: TrendingUp,
  }[streakInfo.icon];

  const iconColor = {
    flame: 'text-orange-500',
    trophy: 'text-yellow-500',
    trending: 'text-green-500',
  }[streakInfo.icon];

  const bgGradient = {
    flame: 'from-orange-50 to-red-50',
    trophy: 'from-yellow-50 to-amber-50',
    trending: 'from-green-50 to-emerald-50',
  }[streakInfo.icon];

  return (
    <div className={`bg-gradient-to-r ${bgGradient} rounded-xl p-4 mb-4 border border-gray-200/50`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-white/80 shadow-sm`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">
            {streakInfo.message}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-current opacity-60" />
              <span className="text-xs text-gray-600">Current: {streakInfo.currentStreak}</span>
            </div>
            {streakInfo.daysToTarget <= 7 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-gray-600">Goal: {streakInfo.targetStreak}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
