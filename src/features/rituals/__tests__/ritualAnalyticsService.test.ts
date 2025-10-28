/**
 * Unit Tests - Ritual Analytics Service (FIXED)
 * Tests streak calculation, mood trends, and completion stats
 */

import { supabase } from '@/lib/supabaseClient';
import { format, subDays } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ritualAnalyticsService } from '../services/ritualAnalyticsService';

// Mock Supabase client - Fixed chain pattern
let mockData: any = null;
let mockError: any = null;

const createMockChain = () => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: mockData, error: mockError }),
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => createMockChain()),
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
    mockData = null;
    mockError = null;
  });

  describe('getRitualCompletionStats()', () => {
    it('should calculate completion stats correctly', async () => {
      mockData = [
        { id: '1', ritual_id: 'ritual-1', duration_seconds: 120, rituals: { id: 'ritual-1', title: 'Morning Energy', goal: 'energy' } },
        { id: '2', ritual_id: 'ritual-1', duration_seconds: 180, rituals: { id: 'ritual-1', title: 'Morning Energy', goal: 'energy' } },
        { id: '3', ritual_id: 'ritual-2', duration_seconds: 300, rituals: { id: 'ritual-2', title: 'Calm Breathing', goal: 'calm' } },
      ];

      const result = await ritualAnalyticsService.getRitualCompletionStats('user-123', {
        start: subDays(new Date(), 30),
        end: new Date(),
      });

      expect(result.totalCompletions).toBe(3);
      expect(result.completionsByRitual['ritual-1'].count).toBe(2);
      expect(result.completionsByRitual['ritual-2'].count).toBe(1);
      expect(result.completionsByGoal.energy).toBe(2);
      expect(result.completionsByGoal.calm).toBe(1);
      expect(result.averageDuration).toBe(200);
    });

    it('should return zero stats when no logs exist', async () => {
      mockData = [];

      const result = await ritualAnalyticsService.getRitualCompletionStats('user-123', {
        start: subDays(new Date(), 30),
        end: new Date(),
      });

      expect(result.totalCompletions).toBe(0);
      expect(result.averageDuration).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      mockError = { message: 'Database error' };

      const result = await ritualAnalyticsService.getRitualCompletionStats('user-123', {
        start: subDays(new Date(), 30),
        end: new Date(),
      });

      expect(result.totalCompletions).toBe(0);
      expect(result.completionsByGoal.energy).toBe(0);
    });

    it('should count completions by goal correctly', async () => {
      mockData = [
        { id: '1', ritual_id: 'r1', duration_seconds: 100, rituals: { id: 'r1', title: 'R1', goal: 'energy' } },
        { id: '2', ritual_id: 'r2', duration_seconds: 100, rituals: { id: 'r2', title: 'R2', goal: 'calm' } },
        { id: '3', ritual_id: 'r3', duration_seconds: 100, rituals: { id: 'r3', title: 'R3', goal: 'focus' } },
        { id: '4', ritual_id: 'r4', duration_seconds: 100, rituals: { id: 'r4', title: 'R4', goal: 'creativity' } },
      ];

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
      mockData = [
        { completed_at: new Date().toISOString(), mood_before: '😐', mood_after: '😊' },
        { completed_at: new Date().toISOString(), mood_before: '😰', mood_after: '😌' },
      ];

      const result = await ritualAnalyticsService.getMoodTrends('user-123', {
        start: subDays(new Date(), 7),
        end: new Date(),
      });

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe(today);
      expect(result[0].completions).toBe(2);
    });

    it('should return empty array on error', async () => {
      mockError = { message: 'Error' };

      const result = await ritualAnalyticsService.getMoodTrends('user-123', {
        start: subDays(new Date(), 7),
        end: new Date(),
      });

      expect(result).toEqual([]);
    });
  });

  describe('getStreakData()', () => {
    it('should calculate current streak correctly', async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const twoDaysAgo = format(subDays(new Date(), 2), 'yyyy-MM-dd');

      mockData = [
        { completed_at: `${today}T10:00:00Z` },
        { completed_at: `${yesterday}T10:00:00Z` },
        { completed_at: `${twoDaysAgo}T10:00:00Z` },
      ];

      const result = await ritualAnalyticsService.getStreakData('user-123');

      expect(result.currentStreak).toBeGreaterThanOrEqual(1);
      expect(result.longestStreak).toBeGreaterThanOrEqual(1);
      expect(result.lastCompletionDate).toBe(mockData[0].completed_at);
    });

    it('should return zero streak for no completions', async () => {
      mockData = [];

      const result = await ritualAnalyticsService.getStreakData('user-123');

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.lastCompletionDate).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockError = { message: 'Error' };

      const result = await ritualAnalyticsService.getStreakData('user-123');

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.lastCompletionDate).toBeNull();
    });
  });

  describe('getAverageMoodImprovement()', () => {
    it('should calculate average mood improvement', async () => {
      mockData = [
        { mood_before: '😰', mood_after: '😊' },
        { mood_before: '😐', mood_after: '😌' },
        { mood_before: '😔', mood_after: '🙂' },
      ];

      const result = await ritualAnalyticsService.getAverageMoodImprovement('user-123', 30);

      expect(result).toBeGreaterThan(0);
    });

    it('should return 0 for no logs', async () => {
      mockData = [];

      const result = await ritualAnalyticsService.getAverageMoodImprovement('user-123', 30);

      expect(result).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      mockError = { message: 'Error' };

      const result = await ritualAnalyticsService.getAverageMoodImprovement('user-123', 30);

      expect(result).toBe(0);
    });
  });

  describe('getMostCompletedRitual()', () => {
    it('should identify most completed ritual', async () => {
      mockData = [
        { id: '1', ritual_id: 'r1', duration_seconds: 100, rituals: { id: 'r1', title: 'Morning Energy', goal: 'energy' } },
        { id: '2', ritual_id: 'r1', duration_seconds: 100, rituals: { id: 'r1', title: 'Morning Energy', goal: 'energy' } },
        { id: '3', ritual_id: 'r1', duration_seconds: 100, rituals: { id: 'r1', title: 'Morning Energy', goal: 'energy' } },
        { id: '4', ritual_id: 'r2', duration_seconds: 100, rituals: { id: 'r2', title: 'Calm Breathing', goal: 'calm' } },
      ];

      const result = await ritualAnalyticsService.getMostCompletedRitual('user-123', 30);

      expect(result).toEqual({ title: 'Morning Energy', count: 3 });
    });

    it('should return null when no rituals completed', async () => {
      mockData = [];

      const result = await ritualAnalyticsService.getMostCompletedRitual('user-123', 30);

      expect(result).toBeNull();
    });
  });

  describe('getCompletionsByGoal()', () => {
    it('should return completions grouped by goal', async () => {
      mockData = [
        { id: '1', ritual_id: 'r1', duration_seconds: 100, rituals: { id: 'r1', title: 'R1', goal: 'energy' } },
        { id: '2', ritual_id: 'r2', duration_seconds: 100, rituals: { id: 'r2', title: 'R2', goal: 'energy' } },
        { id: '3', ritual_id: 'r3', duration_seconds: 100, rituals: { id: 'r3', title: 'R3', goal: 'calm' } },
      ];

      const result = await ritualAnalyticsService.getCompletionsByGoal('user-123', 30);

      expect(result.energy).toBe(2);
      expect(result.calm).toBe(1);
      expect(result.focus).toBe(0);
      expect(result.creativity).toBe(0);
    });
  });
});
