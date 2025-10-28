/**
 * Unit Tests - Ritual Service (REFACTORED)
 * Uses centralized Supabase mock for consistency
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMocks, setMockData, setMockError } from '@/test/mocks/supabase';
import { ritualService } from '../services/ritualService';
import type { Ritual, RitualLog } from '../types/rituals';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RitualService - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  describe('fetchPresets()', () => {
    it('should fetch preset rituals successfully', async () => {
      const mockPresets: Partial<Ritual>[] = [
        { id: 'preset-1', title: 'Morning Energy', goal: 'energy', isPreset: true, tierRequired: 'free' },
        { id: 'preset-2', title: 'Calm Breathing', goal: 'calm', isPreset: true, tierRequired: 'core' },
      ];
      setMockData(mockPresets);

      const result = await ritualService.fetchPresets();

      expect(result).toEqual(mockPresets);
    });

    it('should throw error on database failure', async () => {
      setMockError({ message: 'Database error' });

      await expect(ritualService.fetchPresets()).rejects.toThrow();
    });
  });

  describe('fetchUserRituals()', () => {
    it('should fetch user custom rituals successfully', async () => {
      const mockRituals: Partial<Ritual>[] = [
        { id: 'ritual-1', userId: 'user-123', title: 'Custom', goal: 'focus', isPreset: false }
      ];
      setMockData(mockRituals);

      const result = await ritualService.fetchUserRituals('user-123');

      expect(result).toEqual(mockRituals);
    });

    it('should throw error on failure', async () => {
      setMockError({ message: 'Not found' });

      await expect(ritualService.fetchUserRituals('user-123')).rejects.toThrow();
    });
  });

  describe('fetchRitualById()', () => {
    it('should fetch single ritual successfully', async () => {
      const mockRitual: Partial<Ritual> = { id: 'ritual-123', title: 'Test Ritual', goal: 'calm' };
      setMockData(mockRitual);

      const result = await ritualService.fetchRitualById('ritual-123');

      expect(result).toEqual(mockRitual);
    });

    it('should return null on error', async () => {
      setMockError({ message: 'Not found' });

      const result = await ritualService.fetchRitualById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createRitual()', () => {
    it('should create new ritual successfully', async () => {
      const mockCreated = {
        id: 'ritual-new',
        userId: 'user-123',
        title: 'Morning Flow',
        goal: 'energy',
        isPreset: false,
        createdAt: new Date().toISOString()
      };
      setMockData(mockCreated);

      const newRitual = {
        userId: 'user-123',
        title: 'Morning Flow',
        goal: 'energy' as const,
        steps: [
          { id: 'step-1', type: 'breathing' as const, duration: 120, order: 0, 
            config: { title: 'Deep Breathing', instructions: 'Breathe deeply' }
          }
        ],
        tierRequired: 'core' as const,
      };

      const result = await ritualService.createRitual(newRitual);

      expect(result.id).toBeDefined();
      expect(result.title).toBe('Morning Flow');
    });

    it('should throw error on creation failure', async () => {
      setMockError({ message: 'Validation error' });

      await expect(ritualService.createRitual({
        userId: 'user-123',
        title: '',
        goal: 'energy',
        steps: [],
        tierRequired: 'core'
      })).rejects.toThrow();
    });
  });

  describe('updateRitual()', () => {
    it('should update ritual successfully', async () => {
      const mockUpdated = {
        id: 'ritual-123',
        title: 'Updated Title',
        goal: 'creativity',
        updatedAt: new Date().toISOString()
      };
      setMockData(mockUpdated);

      const result = await ritualService.updateRitual('ritual-123', {
        title: 'Updated Title',
        goal: 'creativity'
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should throw error on update failure', async () => {
      setMockError({ message: 'Not found' });

      await expect(
        ritualService.updateRitual('nonexistent', { title: 'Test' })
      ).rejects.toThrow();
    });
  });

  describe('deleteRitual()', () => {
    it('should delete ritual successfully', async () => {
      setMockData(null);
      setMockError(null);

      await ritualService.deleteRitual('ritual-to-delete');

      // No error thrown = success
      expect(true).toBe(true);
    });

    it('should throw error on delete failure', async () => {
      setMockError({ message: 'Permission denied' });

      await expect(ritualService.deleteRitual('protected')).rejects.toThrow();
    });
  });

  describe('logCompletion()', () => {
    it('should log ritual completion successfully', async () => {
      const mockLogged = {
        id: 'log-new',
        ritualId: 'ritual-123',
        userId: 'user-456',
        durationSeconds: 180,
        moodBefore: '😐',
        moodAfter: '😊',
        completedAt: new Date().toISOString()
      };
      setMockData(mockLogged);

      const completionLog = {
        ritualId: 'ritual-123',
        userId: 'user-456',
        durationSeconds: 180,
        moodBefore: '😐',
        moodAfter: '😊',
        notes: 'Felt great!'
      };

      const result = await ritualService.logCompletion(completionLog);

      expect(result.id).toBeDefined();
      expect(result.moodAfter).toBe('😊');
    });

    it('should throw error on logging failure', async () => {
      setMockError({ message: 'Database error' });

      await expect(
        ritualService.logCompletion({
          ritualId: 'test',
          userId: 'test',
          durationSeconds: 60,
          moodBefore: '😐',
          moodAfter: '😊'
        })
      ).rejects.toThrow();
    });
  });

  describe('fetchUserLogs()', () => {
    it('should fetch user logs successfully', async () => {
      const mockLogs: Partial<RitualLog>[] = [
        { id: 'log-1', userId: 'user-123', ritualId: 'ritual-1', durationSeconds: 120 },
        { id: 'log-2', userId: 'user-123', ritualId: 'ritual-2', durationSeconds: 180 },
      ];
      setMockData(mockLogs);

      const result = await ritualService.fetchUserLogs('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user-123');
    });

    it('should return empty array on error', async () => {
      setMockError({ message: 'Error' });

      const result = await ritualService.fetchUserLogs('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('fetchRitualLogs()', () => {
    it('should fetch logs for specific ritual', async () => {
      const mockLogs: Partial<RitualLog>[] = [
        { id: 'log-1', ritualId: 'ritual-123', userId: 'user-1', durationSeconds: 120 }
      ];
      setMockData(mockLogs);

      const result = await ritualService.fetchRitualLogs('ritual-123');

      expect(result).toHaveLength(1);
      expect(result[0].ritualId).toBe('ritual-123');
    });

    it('should return empty array on error', async () => {
      setMockError({ message: 'Error' });

      const result = await ritualService.fetchRitualLogs('ritual-123');

      expect(result).toEqual([]);
    });
  });
});
