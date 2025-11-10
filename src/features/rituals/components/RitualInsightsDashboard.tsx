/**
 * Ritual Insights Dashboard
 * Displays analytics with Recharts visualizations
 */

import { useUpgradeModals } from '@/contexts/UpgradeModalContext';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useTierQuery } from '@/hooks/useTierQuery';
import { logger } from '@/lib/logger';
import { format, subDays } from 'date-fns';
import { ArrowLeft, Award, Calendar, Sparkles, TrendingUp, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { insightsGenerator } from '../services/insightsGenerator';
import { ritualAnalyticsService, type CompletionStats, type MoodTrend, type StreakData } from '../services/ritualAnalyticsService';
import type { PersonalInsight } from '../types/rituals';

// Atlas color palette
const COLORS = {
  primary: '#D4826C',
  secondary: '#8B7E74',
  energy: '#FF6B6B',
  calm: '#4ECDC4',
  focus: '#FFE66D',
  creativity: '#A06CD5',
  before: '#CBD5E1',
  after: '#10B981',
};

const GOAL_COLORS: Record<string, string> = {
  energy: COLORS.energy,
  calm: COLORS.calm,
  focus: COLORS.focus,
  creativity: COLORS.creativity,
};

export const RitualInsightsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const { tier } = useTierQuery();
  const { showGenericUpgrade } = useUpgradeModals();

  const [loading, setLoading] = useState(true);
  const [moodTrends, setMoodTrends] = useState<MoodTrend[]>([]);
  const [completionStats, setCompletionStats] = useState<CompletionStats | null>(null);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [insights, setInsights] = useState<PersonalInsight[]>([]);
  const [avgMoodImprovement, setAvgMoodImprovement] = useState(0);

  // Tier gate for Free users
  if (tier === 'free') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F5F0E8] to-[#E8DDD2] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-[#E8DCC8] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={32} className="text-orange-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#3B3632] mb-2">Unlock Insights</h2>
          <p className="text-gray-600 mb-6">
            Upgrade to <strong>Core</strong> to see your ritual analytics, mood trends, and personalized insights.
          </p>
          <button
            onClick={() => showGenericUpgrade('audio')}
            className="w-full px-6 py-3 bg-[#3B3632] text-white rounded-xl hover:bg-[#2A2621] transition-colors font-medium"
          >
            Upgrade to Core ($19.99)
          </button>
          <button
            onClick={() => navigate('/rituals')}
            className="mt-3 text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Back to Ritual Library
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!user?.id) return;

    const loadData = async () => {
      try {
        setLoading(true);

        const endDate = new Date();
        const startDate = subDays(endDate, 30);

        const [trends, stats, streak, personalInsights, moodAvg] = await Promise.all([
          ritualAnalyticsService.getMoodTrends(user.id, { start: startDate, end: endDate }),
          ritualAnalyticsService.getRitualCompletionStats(user.id, { start: startDate, end: endDate }),
          ritualAnalyticsService.getStreakData(user.id),
          insightsGenerator.generateInsights(user.id),
          ritualAnalyticsService.getAverageMoodImprovement(user.id, 30),
        ]);

        setMoodTrends(trends);
        setCompletionStats(stats);
        setStreakData(streak);
        setInsights(personalInsights);
        setAvgMoodImprovement(moodAvg);
      } catch (error) {
        logger.error('[RitualInsightsDashboard] Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F5F0E8] to-[#E8DDD2] flex items-center justify-center">
        <div className="text-[#8B7E74] text-lg">Loading insights...</div>
      </div>
    );
  }

  // Prepare data for charts
  const goalData = completionStats
    ? Object.entries(completionStats.completionsByGoal)
        .filter(([_, count]) => count > 0)
        .map(([goal, count]) => ({
          name: goal.charAt(0).toUpperCase() + goal.slice(1),
          value: count,
          color: GOAL_COLORS[goal] || COLORS.primary,
        }))
    : [];

  const completionTrendData = moodTrends.map((trend) => ({
    date: format(new Date(trend.date), 'MMM d'),
    completions: trend.completions,
  }));

  const moodChartData = moodTrends.map((trend) => ({
    date: format(new Date(trend.date), 'MMM d'),
    before: trend.avgMoodBefore,
    after: trend.avgMoodAfter,
  }));

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-[#F5F0E8] to-[#E8DDD2] pb-8 overscroll-contain">
      {/* Header */}
      <div className="bg-white border-b border-[#E8DCC8]">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/rituals')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-[#8B7E74]" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-[#3B3632]">Ritual Insights</h1>
                <p className="text-sm text-[#8B7E74]">Last 30 days</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Completions */}
          <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-6">
            <div className="flex items-center justify-between mb-2">
              <Award size={24} className="text-orange-600" />
              <span className="text-3xl font-bold text-[#3B3632]">
                {completionStats?.totalCompletions || 0}
              </span>
            </div>
            <p className="text-sm text-[#8B7E74]">Total Completions</p>
          </div>

          {/* Current Streak */}
          <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-6">
            <div className="flex items-center justify-between mb-2">
              <Zap size={24} className="text-orange-600" />
              <span className="text-3xl font-bold text-[#3B3632]">
                {streakData?.currentStreak || 0}
              </span>
            </div>
            <p className="text-sm text-[#8B7E74]">Day Streak 🔥</p>
          </div>

          {/* Mood Improvement */}
          <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp size={24} className="text-green-600" />
              <span className="text-3xl font-bold text-[#3B3632]">
                +{(avgMoodImprovement * 20).toFixed(0)}%
              </span>
            </div>
            <p className="text-sm text-[#8B7E74]">Mood Boost</p>
          </div>

          {/* Longest Streak */}
          <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-6">
            <div className="flex items-center justify-between mb-2">
              <Calendar size={24} className="text-purple-600" />
              <span className="text-3xl font-bold text-[#3B3632]">
                {streakData?.longestStreak || 0}
              </span>
            </div>
            <p className="text-sm text-[#8B7E74]">Longest Streak</p>
          </div>
        </div>

        {/* Personal Insights */}
        {insights.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#3B3632] mb-4 flex items-center">
              <Sparkles size={20} className="mr-2 text-orange-600" />
              Personal Insights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map((insight, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-xl border-2 border-[#E8DCC8] p-4 flex items-start space-x-3"
                >
                  <span className="text-3xl">{insight.icon}</span>
                  <p className="text-[#3B3632] flex-1">{insight.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Completion Trend Chart */}
          <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-6">
            <h3 className="text-lg font-bold text-[#3B3632] mb-4">Completion Trend</h3>
            {completionTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={completionTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DCC8" />
                  <XAxis dataKey="date" stroke="#8B7E74" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#8B7E74" style={{ fontSize: '12px' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#FFF',
                      border: '2px solid #E8DCC8',
                      borderRadius: '8px'
                    }} 
                  />
                  <Line
                    type="monotone"
                    dataKey="completions"
                    stroke={COLORS.primary}
                    strokeWidth={3}
                    dot={{ fill: COLORS.primary, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-[#8B7E74]">
                No completion data yet
              </div>
            )}
          </div>

          {/* Rituals by Goal */}
          <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-6">
            <h3 className="text-lg font-bold text-[#3B3632] mb-4">Rituals by Goal</h3>
            {goalData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={goalData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {goalData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-[#8B7E74]">
                Complete rituals to see goal breakdown
              </div>
            )}
          </div>
        </div>

        {/* Mood Journey Chart (Full Width) */}
        <div className="bg-white rounded-xl border-2 border-[#E8DCC8] p-6">
          <h3 className="text-lg font-bold text-[#3B3632] mb-4">Mood Journey</h3>
          {moodChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={moodChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DCC8" />
                <XAxis dataKey="date" stroke="#8B7E74" style={{ fontSize: '12px' }} />
                <YAxis domain={[1, 6]} stroke="#8B7E74" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFF',
                    border: '2px solid #E8DCC8',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="before"
                  stackId="1"
                  stroke={COLORS.before}
                  fill={COLORS.before}
                  fillOpacity={0.6}
                  name="Before Ritual"
                />
                <Area
                  type="monotone"
                  dataKey="after"
                  stackId="2"
                  stroke={COLORS.after}
                  fill={COLORS.after}
                  fillOpacity={0.6}
                  name="After Ritual"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-[#8B7E74]">
              Complete rituals with mood tracking to see trends
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

