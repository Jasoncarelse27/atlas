/**
 * Unit Tests - Ritual Analytics Service
 * Tests streak calculation, mood trends, and completion stats
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ritualAnalyticsService } from '../services/ritualAnalyticsService';
import { supabase } from '@/lib/supabaseClient';
import { subDays, format } from 'date-fns';

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn(),
    })),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('RitualAnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRitualCompletionStats()', () => {
    it('should calculate completion stats correctly', async () => {
      const mockLogs = [
        {
          id: '1',
          ritual_id: 'ritual-1',
          duration_seconds: 120,
          rituals: {
            id: 'ritual-1',
            title: 'Morning Energy',
            goal: 'energy',
          },
        },
        {
          id: '2',
          ritual_id: 'ritual-1',
          duration_seconds: 180,
          rituals: {
            id: 'ritual-1',
            title: 'Morning Energy',
            goal: 'energy',
          },
        },
        {
          id: '3',
          ritual_id: 'ritual-2',
          duration_seconds: 300,
          rituals: {
            id: 'ritual-2',
            title: 'Calm Breathing',
            goal: 'calm',
          },
        },
      ];

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte().order = vi.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await ritualAnalyticsService.getRitualCompletionStats('user-123', {
        start: subDays(new Date(), 30),
        end: new Date(),
      });

      expect(result.totalCompletions).toBe(3);
      expect(result.completionsByRitual['ritual-1'].count).toBe(2);
      expect(result.completionsByRitual['ritual-2'].count).toBe(1);
      expect(result.completionsByGoal.energy).toBe(2);
      expect(result.completionsByGoal.calm).toBe(1);
      expect(result.averageDuration).toBe(200); // (120 + 180 + 300) / 3
    });

    it('should return zero stats when no logs exist', async () => {
      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte().order = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await ritualAnalyticsService.getRitualCompletionStats('user-123', {
        start: subDays(new Date(), 30),
        end: new Date(),
      });

      expect(result.totalCompletions).toBe(0);
      expect(result.averageDuration).toBe(0);
      expect(Object.keys(result.completionsByRitual)).toHaveLength(0);
    });

    it('should handle database errors gracefully', async () => {
      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte().order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await ritualAnalyticsService.getRitualCompletionStats('user-123', {
        start: subDays(new Date(), 30),
        end: new Date(),
      });

      expect(result.totalCompletions).toBe(0);
      expect(result.completionsByGoal).toEqual({
        energy: 0,
        calm: 0,
        focus: 0,
        creativity: 0,
      });
    });

    it('should count completions by goal correctly', async () => {
      const mockLogs = [
        {
          id: '1',
          ritual_id: 'r1',
          duration_seconds: 100,
          rituals: { id: 'r1', title: 'R1', goal: 'energy' },
        },
        {
          id: '2',
          ritual_id: 'r2',
          duration_seconds: 100,
          rituals: { id: 'r2', title: 'R2', goal: 'calm' },
        },
        {
          id: '3',
          ritual_id: 'r3',
          duration_seconds: 100,
          rituals: { id: 'r3', title: 'R3', goal: 'focus' },
        },
        {
          id: '4',
          ritual_id: 'r4',
          duration_seconds: 100,
          rituals: { id: 'r4', title: 'R4', goal: 'creativity' },
        },
      ];

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte().order = vi.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await ritualAnalyticsService.getRitualCompletionStats('user-123', {
        start: subDays(new Date(), 30),
        end: new Date(),
      });

      expect(result.completionsByGoal.energy).toBe(1);
      expect(result.completionsByGoal.calm).toBe(1);
      expect(result.completionsByGoal.focus).toBe(1);
      expect(result.completionsByGoal.creativity).toBe(1);
    });
  });

  describe('getMoodTrends()', () => {
    it('should calculate mood trends per day', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const mockLogs = [
        {
          completed_at: new Date().toISOString(),
          mood_before: '😐', // 3
          mood_after: '😊', // 6
        },
        {
          completed_at: new Date().toISOString(),
          mood_before: '😰', // 1
          mood_after: '😌', // 5
        },
      ];

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte().order = vi.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await ritualAnalyticsService.getMoodTrends('user-123', {
        start: subDays(new Date(), 7),
        end: new Date(),
      });

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe(today);
      expect(result[0].avgMoodBefore).toBe(2); // (3 + 1) / 2
      expect(result[0].avgMoodAfter).toBe(5.5); // (6 + 5) / 2
      expect(result[0].improvement).toBe(3.5); // 5.5 - 2
      expect(result[0].completions).toBe(2);
    });

    it('should group completions by date', async () => {
      const today = new Date();
      const yesterday = subDays(today, 1);

      const mockLogs = [
        {
          completed_at: today.toISOString(),
          mood_before: '😐',
          mood_after: '😊',
        },
        {
          completed_at: yesterday.toISOString(),
          mood_before: '😰',
          mood_after: '😌',
        },
      ];

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte().order = vi.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await ritualAnalyticsService.getMoodTrends('user-123', {
        start: subDays(new Date(), 7),
        end: new Date(),
      });

      expect(result).toHaveLength(2);
      expect(result[0].completions).toBe(1);
      expect(result[1].completions).toBe(1);
    });

    it('should return empty array on error', async () => {
      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte().order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });

      const result = await ritualAnalyticsService.getMoodTrends('user-123', {
        start: subDays(new Date(), 7),
        end: new Date(),
      });

      expect(result).toEqual([]);
    });

    it('should handle unknown mood emojis with default value', async () => {
      const mockLogs = [
        {
          completed_at: new Date().toISOString(),
          mood_before: '🤔', // Unknown, defaults to 3
          mood_after: '🎉', // Unknown, defaults to 3
        },
      ];

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte().order = vi.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await ritualAnalyticsService.getMoodTrends('user-123', {
        start: subDays(new Date(), 7),
        end: new Date(),
      });

      expect(result[0].avgMoodBefore).toBe(3);
      expect(result[0].avgMoodAfter).toBe(3);
      expect(result[0].improvement).toBe(0);
    });
  });

  describe('getStreakData()', () => {
    it('should calculate current streak correctly', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const twoDaysAgo = format(subDays(new Date(), 2), 'yyyy-MM-dd');

      const mockLogs = [
        { completed_at: `${today}T10:00:00Z` },
        { completed_at: `${yesterday}T10:00:00Z` },
        { completed_at: `${twoDaysAgo}T10:00:00Z` },
      ];

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().order = vi.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await ritualAnalyticsService.getStreakData('user-123');

      expect(result.currentStreak).toBe(3);
      expect(result.longestStreak).toBeGreaterThanOrEqual(3);
      expect(result.lastCompletionDate).toBe(mockLogs[0].completed_at);
    });

    it('should return zero streak for no completions', async () => {
      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().order = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await ritualAnalyticsService.getStreakData('user-123');

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.lastCompletionDate).toBeNull();
    });

    it('should break streak if day is missed', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const threeDaysAgo = format(subDays(new Date(), 3), 'yyyy-MM-dd');

      const mockLogs = [
        { completed_at: `${today}T10:00:00Z` },
        { completed_at: `${threeDaysAgo}T10:00:00Z` }, // Gap of 2 days
      ];

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().order = vi.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await ritualAnalyticsService.getStreakData('user-123');

      expect(result.currentStreak).toBe(1); // Only today counts
    });

    it('should calculate longest streak from history', async () => {
      const mockLogs = [
        { completed_at: `${format(subDays(new Date(), 0), 'yyyy-MM-dd')}T10:00:00Z` },
        { completed_at: `${format(subDays(new Date(), 1), 'yyyy-MM-dd')}T10:00:00Z` },
        { completed_at: `${format(subDays(new Date(), 5), 'yyyy-MM-dd')}T10:00:00Z` },
        { completed_at: `${format(subDays(new Date(), 6), 'yyyy-MM-dd')}T10:00:00Z` },
        { completed_at: `${format(subDays(new Date(), 7), 'yyyy-MM-dd')}T10:00:00Z` },
        { completed_at: `${format(subDays(new Date(), 8), 'yyyy-MM-dd')}T10:00:00Z` },
      ];

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().order = vi.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await ritualAnalyticsService.getStreakData('user-123');

      expect(result.longestStreak).toBeGreaterThanOrEqual(2);
    });

    it('should handle database errors gracefully', async () => {
      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });

      const result = await ritualAnalyticsService.getStreakData('user-123');

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.lastCompletionDate).toBeNull();
    });
  });

  describe('getAverageMoodImprovement()', () => {
    it('should calculate average mood improvement', async () => {
      const mockLogs = [
        { mood_before: '😰', mood_after: '😊' }, // +5 (1 → 6)
        { mood_before: '😐', mood_after: '😌' }, // +2 (3 → 5)
        { mood_before: '😔', mood_after: '🙂' }, // +2 (2 → 4)
      ];

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte = vi.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await ritualAnalyticsService.getAverageMoodImprovement('user-123', 30);

      expect(result).toBe(3); // (5 + 2 + 2) / 3 = 3
    });

    it('should return 0 for no logs', async () => {
      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await ritualAnalyticsService.getAverageMoodImprovement('user-123', 30);

      expect(result).toBe(0);
    });

    it('should handle negative mood changes', async () => {
      const mockLogs = [
        { mood_before: '😊', mood_after: '😐' }, // -3 (6 → 3)
      ];

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte = vi.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await ritualAnalyticsService.getAverageMoodImprovement('user-123', 30);

      expect(result).toBe(-3);
    });

    it('should handle database errors gracefully', async () => {
      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });

      const result = await ritualAnalyticsService.getAverageMoodImprovement('user-123', 30);

      expect(result).toBe(0);
    });
  });

  describe('getMostCompletedRitual()', () => {
    it('should identify most completed ritual', async () => {
      const mockLogs = [
        { id: '1', ritual_id: 'r1', duration_seconds: 100, rituals: { id: 'r1', title: 'Morning Energy', goal: 'energy' } },
        { id: '2', ritual_id: 'r1', duration_seconds: 100, rituals: { id: 'r1', title: 'Morning Energy', goal: 'energy' } },
        { id: '3', ritual_id: 'r1', duration_seconds: 100, rituals: { id: 'r1', title: 'Morning Energy', goal: 'energy' } },
        { id: '4', ritual_id: 'r2', duration_seconds: 100, rituals: { id: 'r2', title: 'Calm Breathing', goal: 'calm' } },
      ];

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte().order = vi.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await ritualAnalyticsService.getMostCompletedRitual('user-123', 30);

      expect(result).toEqual({
        title: 'Morning Energy',
        count: 3,
      });
    });

    it('should return null when no rituals completed', async () => {
      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte().order = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await ritualAnalyticsService.getMostCompletedRitual('user-123', 30);

      expect(result).toBeNull();
    });
  });

  describe('getCompletionsByGoal()', () => {
    it('should return completions grouped by goal', async () => {
      const mockLogs = [
        { id: '1', ritual_id: 'r1', duration_seconds: 100, rituals: { id: 'r1', title: 'R1', goal: 'energy' } },
        { id: '2', ritual_id: 'r2', duration_seconds: 100, rituals: { id: 'r2', title: 'R2', goal: 'energy' } },
        { id: '3', ritual_id: 'r3', duration_seconds: 100, rituals: { id: 'r3', title: 'R3', goal: 'calm' } },
      ];

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().gte().lte().order = vi.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await ritualAnalyticsService.getCompletionsByGoal('user-123', 30);

      expect(result.energy).toBe(2);
      expect(result.calm).toBe(1);
      expect(result.focus).toBe(0);
      expect(result.creativity).toBe(0);
    });
  });
});

