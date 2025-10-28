/**
 * Unit Tests - Ritual Service (FIXED)
 * Tests CRUD operations for rituals and ritual logs
 */

import { supabase } from '@/lib/supabaseClient';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ritualService } from '../services/ritualService';
import type { Ritual, RitualLog } from '../types/rituals';

// Mock Supabase client - Fixed chain pattern
let mockData: any = null;
let mockError: any = null;

const createMockChain = () => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockResolvedValue({ data: mockData, error: mockError }),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: mockData, error: mockError }),
  single: vi.fn().mockResolvedValue({ data: mockData, error: mockError }),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => createMockChain()),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RitualService - CRUD Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData = null;
    mockError = null;
  });

  describe('fetchPresets()', () => {
    it('should fetch preset rituals successfully', async () => {
      mockData = [
        { id: 'preset-1', title: 'Morning Energy', goal: 'energy', isPreset: true, tierRequired: 'free' },
        { id: 'preset-2', title: 'Calm Breathing', goal: 'calm', isPreset: true, tierRequired: 'core' },
      ];

      const result = await ritualService.fetchPresets();

      expect(result).toEqual(mockData);
    });

    it('should return empty array on error', async () => {
      mockError = { message: 'Database error' };
      await expect(ritualService.fetchPresets()).rejects.toThrow();
    });

    it('should order presets by tier and title', async () => {
      mockData = [];
      await ritualService.fetchPresets();
      expect(supabase.from).toHaveBeenCalledWith('rituals');
    });
  });

  describe('fetchUserRituals()', () => {
    it('should fetch user custom rituals successfully', async () => {
      mockData = [{ id: 'ritual-1', userId: 'user-123', title: 'Custom', goal: 'focus', isPreset: false }];
      const result = await ritualService.fetchUserRituals('user-123');
      expect(result).toEqual(mockData);
    });

    it('should filter by user_id and is_preset=false', async () => {
      mockData = [];
      await ritualService.fetchUserRituals('user-456');
      expect(supabase.from).toHaveBeenCalledWith('rituals');
    });

    it('should return empty array on error', async () => {
      mockError = { message: 'Not found' };
      await expect(ritualService.fetchUserRituals('user-123')).rejects.toThrow();
    });
  });

  describe('fetchRitualById()', () => {
    it('should fetch single ritual successfully', async () => {
      mockData = { id: 'ritual-123', title: 'Test Ritual', goal: 'calm' };
      const result = await ritualService.fetchRitualById('ritual-123');
      expect(result).toEqual(mockData);
    });

    it('should return null on error', async () => {
      mockError = { message: 'Not found' };
      const result = await ritualService.fetchRitualById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('createRitual()', () => {
    it('should create new ritual successfully', async () => {
      const newRitual = {
        userId: 'user-123',
        title: 'Morning Flow',
        goal: 'energy' as const,
        steps: [{ id: 'step-1', type: 'breathing' as const, duration: 120, order: 0, config: { title: 'Deep Breathing', instructions: 'Breathe deeply' } }],
        tierRequired: 'core' as const,
      };

      mockData = { id: 'ritual-new', ...newRitual, isPreset: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

      const result = await ritualService.createRitual(newRitual);
      expect(result).toEqual(mockData);
    });

    it('should throw error on creation failure', async () => {
      mockError = { message: 'Validation error' };
      await expect(ritualService.createRitual({ userId: 'user-123', title: '', goal: 'energy', steps: [], tierRequired: 'core' })).rejects.toThrow();
    });

    it('should set is_preset to false for custom rituals', async () => {
      mockData = { id: 'new', isPreset: false };
      await ritualService.createRitual({ userId: 'user-123', title: 'Custom', goal: 'focus', steps: [], tierRequired: 'studio' });
      expect(supabase.from).toHaveBeenCalledWith('rituals');
    });
  });

  describe('updateRitual()', () => {
    it('should update ritual successfully', async () => {
      mockData = { id: 'ritual-123', title: 'Updated Title', goal: 'creativity', updatedAt: new Date().toISOString() };
      const result = await ritualService.updateRitual('ritual-123', { title: 'Updated Title', goal: 'creativity' });
      expect(result).toEqual(mockData);
    });

    it('should throw error on update failure', async () => {
      mockError = { message: 'Not found' };
      await expect(ritualService.updateRitual('nonexistent', { title: 'Test' })).rejects.toThrow();
    });
  });

  describe('deleteRitual()', () => {
    it('should delete ritual successfully', async () => {
      mockError = null;
      await ritualService.deleteRitual('ritual-to-delete');
      expect(supabase.from).toHaveBeenCalledWith('rituals');
    });

    it('should throw error on delete failure', async () => {
      mockError = { message: 'Permission denied' };
      await expect(ritualService.deleteRitual('protected')).rejects.toThrow();
    });
  });

  describe('logCompletion()', () => {
    it('should log ritual completion successfully', async () => {
      const completionLog = { ritualId: 'ritual-123', userId: 'user-456', durationSeconds: 180, moodBefore: '😐', moodAfter: '😊', notes: 'Felt great!' };
      mockData = { id: 'log-new', ...completionLog, completedAt: new Date().toISOString() };

      const result = await ritualService.logCompletion(completionLog);
      expect(result).toEqual(mockData);
    });

    it('should throw error on logging failure', async () => {
      mockError = { message: 'Database error' };
      await expect(ritualService.logCompletion({ ritualId: 'test', userId: 'test', durationSeconds: 60, moodBefore: '😐', moodAfter: '😊' })).rejects.toThrow();
    });
  });

  describe('fetchUserLogs()', () => {
    it('should fetch user logs successfully', async () => {
      mockData = [
        { id: 'log-1', userId: 'user-123', ritualId: 'ritual-1', durationSeconds: 120, moodBefore: '😐', moodAfter: '😊' },
        { id: 'log-2', userId: 'user-123', ritualId: 'ritual-2', durationSeconds: 180, moodBefore: '😰', moodAfter: '😌' },
      ];

      const result = await ritualService.fetchUserLogs('user-123');
      expect(result).toEqual(mockData);
      expect(result).toHaveLength(2);
    });

    it('should limit results to specified count', async () => {
      mockData = [];
      await ritualService.fetchUserLogs('user-123', 10);
      expect(supabase.from).toHaveBeenCalledWith('ritual_logs');
    });

    it('should return empty array on error', async () => {
      mockError = { message: 'Error' };
      const result = await ritualService.fetchUserLogs('user-123');
      expect(result).toEqual([]);
    });

    it('should default to 50 logs limit', async () => {
      mockData = [];
      await ritualService.fetchUserLogs('user-123');
      expect(supabase.from).toHaveBeenCalledWith('ritual_logs');
    });
  });

  describe('fetchRitualLogs()', () => {
    it('should fetch logs for specific ritual', async () => {
      mockData = [{ id: 'log-1', ritualId: 'ritual-123', userId: 'user-1', durationSeconds: 120 }];
      const result = await ritualService.fetchRitualLogs('ritual-123');
      expect(result).toEqual(mockData);
    });

    it('should default to 20 logs limit', async () => {
      mockData = [];
      await ritualService.fetchRitualLogs('ritual-123');
      expect(supabase.from).toHaveBeenCalledWith('ritual_logs');
    });

    it('should return empty array on error', async () => {
      mockError = { message: 'Error' };
      const result = await ritualService.fetchRitualLogs('ritual-123');
      expect(result).toEqual([]);
    });
  });
});
