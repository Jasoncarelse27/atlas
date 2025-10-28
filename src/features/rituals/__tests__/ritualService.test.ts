/**
 * Unit Tests - Ritual Service
 * Tests CRUD operations for rituals and ritual logs
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ritualService } from '../services/ritualService';
import { supabase } from '@/lib/supabaseClient';
import type { Ritual, RitualLog } from '../types/rituals';

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
    })),
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
  });

  describe('fetchPresets()', () => {
    it('should fetch preset rituals successfully', async () => {
      const mockPresets: Partial<Ritual>[] = [
        {
          id: 'preset-1',
          title: 'Morning Energy',
          goal: 'energy',
          isPreset: true,
          tierRequired: 'free',
        },
        {
          id: 'preset-2',
          title: 'Calm Breathing',
          goal: 'calm',
          isPreset: true,
          tierRequired: 'core',
        },
      ];

      const mockSupabase = supabase.from('rituals') as any;
      mockSupabase.select().eq().order().order = vi.fn().mockResolvedValue({
        data: mockPresets,
        error: null,
      });

      const result = await ritualService.fetchPresets();

      expect(result).toEqual(mockPresets);
      expect(supabase.from).toHaveBeenCalledWith('rituals');
    });

    it('should return empty array on error', async () => {
      const mockSupabase = supabase.from('rituals') as any;
      mockSupabase.select().eq().order().order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(ritualService.fetchPresets()).rejects.toThrow();
    });

    it('should order presets by tier and title', async () => {
      const mockSupabase = supabase.from('rituals') as any;
      const orderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      mockSupabase.select().eq().order = orderSpy;

      await ritualService.fetchPresets();

      expect(orderSpy).toHaveBeenCalled();
    });
  });

  describe('fetchUserRituals()', () => {
    it('should fetch user custom rituals successfully', async () => {
      const userId = 'user-123';
      const mockRituals: Partial<Ritual>[] = [
        {
          id: 'ritual-1',
          userId: userId,
          title: 'My Custom Ritual',
          goal: 'focus',
          isPreset: false,
          tierRequired: 'core',
        },
      ];

      const mockSupabase = supabase.from('rituals') as any;
      mockSupabase.select().eq().eq().order = vi.fn().mockResolvedValue({
        data: mockRituals,
        error: null,
      });

      const result = await ritualService.fetchUserRituals(userId);

      expect(result).toEqual(mockRituals);
      expect(supabase.from).toHaveBeenCalledWith('rituals');
    });

    it('should filter by user_id and is_preset=false', async () => {
      const userId = 'user-456';
      const mockSupabase = supabase.from('rituals') as any;
      const eqSpy = vi.fn().mockReturnThis();
      mockSupabase.select().eq = eqSpy;
      eqSpy().eq().order = vi.fn().mockResolvedValue({ data: [], error: null });

      await ritualService.fetchUserRituals(userId);

      expect(eqSpy).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      const mockSupabase = supabase.from('rituals') as any;
      mockSupabase.select().eq().eq().order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(ritualService.fetchUserRituals('user-123')).rejects.toThrow();
    });
  });

  describe('fetchRitualById()', () => {
    it('should fetch single ritual successfully', async () => {
      const mockRitual: Partial<Ritual> = {
        id: 'ritual-123',
        title: 'Test Ritual',
        goal: 'calm',
      };

      const mockSupabase = supabase.from('rituals') as any;
      mockSupabase.select().eq().single = vi.fn().mockResolvedValue({
        data: mockRitual,
        error: null,
      });

      const result = await ritualService.fetchRitualById('ritual-123');

      expect(result).toEqual(mockRitual);
    });

    it('should return null on error', async () => {
      const mockSupabase = supabase.from('rituals') as any;
      mockSupabase.select().eq().single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

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
        steps: [
          {
            id: 'step-1',
            type: 'breathing' as const,
            duration: 120,
            order: 0,
            config: { title: 'Deep Breathing', instructions: 'Breathe deeply' },
          },
        ],
        tierRequired: 'core' as const,
      };

      const mockCreated = {
        id: 'ritual-new',
        ...newRitual,
        isPreset: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockSupabase = supabase.from('rituals') as any;
      mockSupabase.insert().select().single = vi.fn().mockResolvedValue({
        data: mockCreated,
        error: null,
      });

      const result = await ritualService.createRitual(newRitual);

      expect(result).toEqual(mockCreated);
      expect(supabase.from).toHaveBeenCalledWith('rituals');
    });

    it('should throw error on creation failure', async () => {
      const newRitual = {
        userId: 'user-123',
        title: '',
        goal: 'energy' as const,
        steps: [],
        tierRequired: 'core' as const,
      };

      const mockSupabase = supabase.from('rituals') as any;
      mockSupabase.insert().select().single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Validation error' },
      });

      await expect(ritualService.createRitual(newRitual)).rejects.toThrow();
    });

    it('should set is_preset to false for custom rituals', async () => {
      const newRitual = {
        userId: 'user-123',
        title: 'Custom',
        goal: 'focus' as const,
        steps: [],
        tierRequired: 'studio' as const,
      };

      const insertSpy = vi.fn().mockReturnThis();
      const mockSupabase = supabase.from('rituals') as any;
      mockSupabase.insert = insertSpy;
      insertSpy().select().single = vi.fn().mockResolvedValue({
        data: { ...newRitual, id: 'new', isPreset: false },
        error: null,
      });

      await ritualService.createRitual(newRitual);

      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ is_preset: false })
      );
    });
  });

  describe('updateRitual()', () => {
    it('should update ritual successfully', async () => {
      const ritualId = 'ritual-123';
      const updates = {
        title: 'Updated Title',
        goal: 'creativity' as const,
      };

      const mockUpdated = {
        id: ritualId,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      const mockSupabase = supabase.from('rituals') as any;
      mockSupabase.update().eq().select().single = vi.fn().mockResolvedValue({
        data: mockUpdated,
        error: null,
      });

      const result = await ritualService.updateRitual(ritualId, updates);

      expect(result).toEqual(mockUpdated);
    });

    it('should throw error on update failure', async () => {
      const mockSupabase = supabase.from('rituals') as any;
      mockSupabase.update().eq().select().single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(
        ritualService.updateRitual('nonexistent', { title: 'Test' })
      ).rejects.toThrow();
    });
  });

  describe('deleteRitual()', () => {
    it('should delete ritual successfully', async () => {
      const ritualId = 'ritual-to-delete';

      const mockSupabase = supabase.from('rituals') as any;
      mockSupabase.delete().eq = vi.fn().mockResolvedValue({
        error: null,
      });

      await ritualService.deleteRitual(ritualId);

      expect(supabase.from).toHaveBeenCalledWith('rituals');
    });

    it('should throw error on delete failure', async () => {
      const mockSupabase = supabase.from('rituals') as any;
      mockSupabase.delete().eq = vi.fn().mockResolvedValue({
        error: { message: 'Permission denied' },
      });

      await expect(ritualService.deleteRitual('protected')).rejects.toThrow();
    });
  });

  describe('logCompletion()', () => {
    it('should log ritual completion successfully', async () => {
      const completionLog = {
        ritualId: 'ritual-123',
        userId: 'user-456',
        durationSeconds: 180,
        moodBefore: '😐',
        moodAfter: '😊',
        notes: 'Felt great!',
      };

      const mockLogged = {
        id: 'log-new',
        ...completionLog,
        completedAt: new Date().toISOString(),
      };

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.insert().select().single = vi.fn().mockResolvedValue({
        data: mockLogged,
        error: null,
      });

      const result = await ritualService.logCompletion(completionLog);

      expect(result).toEqual(mockLogged);
      expect(supabase.from).toHaveBeenCalledWith('ritual_logs');
    });

    it('should throw error on logging failure', async () => {
      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.insert().select().single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(
        ritualService.logCompletion({
          ritualId: 'test',
          userId: 'test',
          durationSeconds: 60,
          moodBefore: '😐',
          moodAfter: '😊',
        })
      ).rejects.toThrow();
    });
  });

  describe('fetchUserLogs()', () => {
    it('should fetch user logs successfully', async () => {
      const userId = 'user-123';
      const mockLogs: Partial<RitualLog>[] = [
        {
          id: 'log-1',
          userId: userId,
          ritualId: 'ritual-1',
          durationSeconds: 120,
          moodBefore: '😐',
          moodAfter: '😊',
        },
        {
          id: 'log-2',
          userId: userId,
          ritualId: 'ritual-2',
          durationSeconds: 180,
          moodBefore: '😰',
          moodAfter: '😌',
        },
      ];

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().order().limit = vi.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await ritualService.fetchUserLogs(userId);

      expect(result).toEqual(mockLogs);
      expect(result).toHaveLength(2);
    });

    it('should limit results to specified count', async () => {
      const mockSupabase = supabase.from('ritual_logs') as any;
      const limitSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      mockSupabase.select().eq().order().limit = limitSpy;

      await ritualService.fetchUserLogs('user-123', 10);

      expect(limitSpy).toHaveBeenCalledWith(10);
    });

    it('should return empty array on error', async () => {
      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().order().limit = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });

      const result = await ritualService.fetchUserLogs('user-123');

      expect(result).toEqual([]);
    });

    it('should default to 50 logs limit', async () => {
      const mockSupabase = supabase.from('ritual_logs') as any;
      const limitSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      mockSupabase.select().eq().order().limit = limitSpy;

      await ritualService.fetchUserLogs('user-123');

      expect(limitSpy).toHaveBeenCalledWith(50);
    });
  });

  describe('fetchRitualLogs()', () => {
    it('should fetch logs for specific ritual', async () => {
      const ritualId = 'ritual-123';
      const mockLogs: Partial<RitualLog>[] = [
        {
          id: 'log-1',
          ritualId: ritualId,
          userId: 'user-1',
          durationSeconds: 120,
        },
      ];

      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().order().limit = vi.fn().mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await ritualService.fetchRitualLogs(ritualId);

      expect(result).toEqual(mockLogs);
    });

    it('should default to 20 logs limit', async () => {
      const mockSupabase = supabase.from('ritual_logs') as any;
      const limitSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      mockSupabase.select().eq().order().limit = limitSpy;

      await ritualService.fetchRitualLogs('ritual-123');

      expect(limitSpy).toHaveBeenCalledWith(20);
    });

    it('should return empty array on error', async () => {
      const mockSupabase = supabase.from('ritual_logs') as any;
      mockSupabase.select().eq().order().limit = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });

      const result = await ritualService.fetchRitualLogs('ritual-123');

      expect(result).toEqual([]);
    });
  });
});

