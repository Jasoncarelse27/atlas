/**
 * Emotional Insights Widgets for Sidebar
 * Shows mood tracking line graph and conversation analysis pie chart
 * 
 * Features:
 * - Compact sidebar-friendly visualizations
 * - Lazy loading (only loads when sidebar is open)
 * - Tier-gated (FREE shows upgrade prompt)
 * - Cached data (30 second TTL)
 * - Auto-refresh every 30 seconds
 */

import { useUpgradeModals } from '@/contexts/UpgradeModalContext';
import { useTierQuery } from '@/hooks/useTierQuery';
import { logger } from '@/lib/logger';
import { format, subDays } from 'date-fns';
import { BarChart3, Brain, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ritualAnalyticsService, type CompletionStats, type MoodTrend } from '@/features/rituals/services/ritualAnalyticsService';

interface EmotionalInsightsWidgetsProps {
  userId: string;
  isOpen: boolean; // Only load when sidebar is open
}

interface WidgetData {
  moodTrends: MoodTrend[];
  completionStats: CompletionStats | null;
}

const INSIGHTS_CACHE_TTL = 30 * 1000; // 30 seconds

// Atlas color palette
const COLORS = {
  energy: '#FF6B6B',
  creativity: '#A06CD5',
  moodLine: '#D4826C',
  moodBg: '#D4826C20',
};

const GOAL_COLORS: Record<string, string> = {
  energy: COLORS.energy,
  calm: '#4ECDC4',
  focus: '#FFE66D',
  creativity: COLORS.creativity,
};

export function EmotionalInsightsWidgets({ userId, isOpen }: EmotionalInsightsWidgetsProps) {
  const { tier } = useTierQuery();
  const { showGenericUpgrade } = useUpgradeModals();
  
  const [widgetData, setWidgetData] = useState<WidgetData>({
    moodTrends: [],
    completionStats: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  
  // ✅ CACHE: Store data with timestamp
  const cacheRef = useRef<{ data: WidgetData; timestamp: number } | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ LAZY LOAD: Only fetch when sidebar opens
  useEffect(() => {
    if (!isOpen || !userId) return;
    
    // Check cache first
    if (cacheRef.current && Date.now() - cacheRef.current.timestamp < INSIGHTS_CACHE_TTL) {
      setWidgetData(cacheRef.current.data);
      logger.debug('[EmotionalInsightsWidgets] ✅ Using cached data');
      return;
    }

    // Load fresh data
    const loadInsights = async () => {
      setIsLoading(true);
      try {
        const endDate = new Date();
        const startDate = subDays(endDate, 30);

        // ✅ EFFICIENT: Parallel requests
        const [trends, stats] = await Promise.all([
          ritualAnalyticsService.getMoodTrends(userId, { start: startDate, end: endDate }),
          ritualAnalyticsService.getRitualCompletionStats(userId, { start: startDate, end: endDate }),
        ]);

        const data: WidgetData = {
          moodTrends: trends,
          completionStats: stats,
        };

        // ✅ CACHE: Store with timestamp
        cacheRef.current = { data, timestamp: Date.now() };
        setWidgetData(data);
        logger.debug('[EmotionalInsightsWidgets] ✅ Data loaded and cached');
      } catch (error) {
        logger.error('[EmotionalInsightsWidgets] Failed to load insights:', error);
        // Don't show error to user (widgets are non-critical)
      } finally {
        setIsLoading(false);
      }
    };

    loadInsights();

    // ✅ AUTO-REFRESH: Update every 30 seconds while sidebar is open
    refreshIntervalRef.current = setInterval(() => {
      loadInsights();
    }, 30000); // 30 seconds

    // ✅ CLEANUP: Clear interval when sidebar closes
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [isOpen, userId]);

  // ✅ TIER GATING: Free users see upgrade prompt
  if (tier === 'free') {
    return (
      <div className="bg-transparent border-transparent p-4 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-xl bg-[#B8A5D6]/20">
            <BarChart3 className="w-4 h-4 text-[#8B7AB8]" />
          </div>
          <h3 className="text-[#5A524A] dark:text-white font-medium text-sm">Emotional Insights</h3>
        </div>
        
        <div className="space-y-3">
          <div className="text-center py-4">
            <div className="flex items-center justify-center mb-2">
              <div className="p-3 rounded-xl bg-[#B8A5D6]/20 dark:bg-gray-700/50">
                <Brain className="w-8 h-8 text-[#8B7AB8] dark:text-gray-300" />
              </div>
            </div>
            <p className="text-[#8B7E74] dark:text-gray-400 text-sm mb-4">
              Track your emotional patterns and conversation insights
            </p>
            <div 
              onClick={() => showGenericUpgrade('audio')}
              className="bg-gradient-to-r from-[#C8956A] to-[#B8855A] rounded-xl p-3 border-2 border-[#E8DCC8] cursor-pointer hover:shadow-lg transition-all active:scale-[0.98]"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  showGenericUpgrade('audio');
                }
              }}
            >
              <div className="flex items-center gap-2 justify-center">
                <Sparkles className="w-4 h-4 text-white" />
                <p className="text-white font-semibold text-xs">Unlock Insights</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[#8B7E74] dark:text-gray-400">Mood Tracking</span>
              <span className="text-[#8FA67E] dark:text-green-400 font-medium bg-[#8FA67E]/10 dark:bg-green-400/10 px-2 py-0.5 rounded">Active</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#8B7E74] dark:text-gray-400">Conversation Analysis</span>
              <span className="text-[#F3B562] dark:text-yellow-400 font-medium bg-[#F3B562]/10 dark:bg-yellow-400/10 px-2 py-0.5 rounded">Coming Soon</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#8B7E74] dark:text-gray-400">Wellness Score</span>
              <span className="text-[#9B8FDB] dark:text-purple-400 font-medium bg-[#9B8FDB]/10 dark:bg-purple-400/10 px-2 py-0.5 rounded">Beta</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Prepare chart data - show last 3 data points (10, 20, 30 on x-axis)
  const recentTrends = widgetData.moodTrends.slice(-3);
  const moodChartData = recentTrends.length > 0
    ? recentTrends.map((trend, index) => ({
        day: (index + 1) * 10, // 10, 20, 30 for x-axis
        mood: trend.avgMoodAfter || trend.avgMoodBefore || 3, // Default to neutral if no data
      }))
    : [
        { day: 10, mood: 3 },
        { day: 20, mood: 3 },
        { day: 30, mood: 3 },
      ];

  const goalData = widgetData.completionStats
    ? Object.entries(widgetData.completionStats.completionsByGoal)
        .filter(([_, count]) => count > 0)
        .map(([goal, count]) => ({
          name: goal.charAt(0).toUpperCase() + goal.slice(1),
          value: count,
          color: GOAL_COLORS[goal] || COLORS.energy,
        }))
    : [];

  // Show loading state
  if (isLoading && widgetData.moodTrends.length === 0) {
    return (
      <div className="bg-transparent border-transparent p-4 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-xl bg-[#B8A5D6]/20">
            <BarChart3 className="w-4 h-4 text-[#8B7AB8]" />
          </div>
          <h3 className="text-[#5A524A] dark:text-white font-medium text-sm">Emotional Insights</h3>
        </div>
        <div className="space-y-3">
          <div className="h-32 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-[#E8DDD2] dark:border-gray-700 animate-pulse" />
          <div className="h-32 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-[#E8DDD2] dark:border-gray-700 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-transparent border-transparent p-4 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-xl bg-[#B8A5D6]/20">
          <BarChart3 className="w-4 h-4 text-[#8B7AB8]" />
        </div>
        <h3 className="text-[#5A524A] dark:text-white font-medium text-sm">Emotional Insights</h3>
      </div>
      
      <div className="space-y-3">
        {/* Mood Tracking Widget */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#E8DDD2] dark:border-gray-700 p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[#8B7E74] dark:text-gray-400 text-xs font-medium">Mood Tracking</span>
            <span className="text-[#8FA67E] dark:text-green-400 font-medium bg-[#8FA67E]/10 dark:bg-green-400/10 px-2 py-0.5 rounded text-xs">Active</span>
          </div>
          {moodChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={moodChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#FFF',
                    border: '1px solid #E8DDD2',
                    borderRadius: '6px',
                    fontSize: '11px',
                    padding: '4px 8px',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="mood" 
                  stroke={COLORS.moodLine} 
                  strokeWidth={2.5}
                  dot={{ fill: COLORS.moodLine, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-20 flex items-center justify-center text-[#8B7E74] dark:text-gray-400 text-xs">
              Complete rituals to see mood trends
            </div>
          )}
        </div>

        {/* Conversation Analysis Widget */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#E8DDD2] dark:border-gray-700 p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[#8B7E74] dark:text-gray-400 text-xs font-medium">Conversation Analysis</span>
            <span className="text-[#F3B562] dark:text-yellow-400 font-medium bg-[#F3B562]/10 dark:bg-yellow-400/10 px-2 py-0.5 rounded text-xs">Active</span>
          </div>
          {goalData.length > 0 ? (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width={80} height={80}>
                <PieChart>
                  <Pie
                    data={goalData}
                    cx="50%"
                    cy="50%"
                    innerRadius={18}
                    outerRadius={32}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {goalData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#FFF',
                      border: '1px solid #E8DDD2',
                      borderRadius: '6px',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {goalData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-[#8B7E74] dark:text-gray-400 font-medium">
                      {item.name}: <span className="text-[#3B3632] dark:text-white">{item.value}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center text-[#8B7E74] dark:text-gray-400 text-xs">
              Complete rituals to see analysis
            </div>
          )}
        </div>

        {/* Wellness Score Widget */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#E8DDD2] dark:border-gray-700 p-3">
          <div className="flex justify-between items-center">
            <span className="text-[#8B7E74] dark:text-gray-400 text-xs font-medium">Wellness Score</span>
            <span className="text-[#9B8FDB] dark:text-purple-400 font-medium bg-[#9B8FDB]/10 dark:bg-purple-400/10 px-2 py-0.5 rounded text-xs">Beta</span>
          </div>
        </div>
      </div>
    </div>
  );
}

