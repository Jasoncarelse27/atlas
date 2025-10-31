/**
 * MessagePersistenceService Unit Tests
 * 
 * Tests for the extracted MessagePersistenceService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessagePersistenceService } from '../MessagePersistenceService';

// Mock Supabase
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({
  insert: mockInsert,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('MessagePersistenceService', () => {
  let service: MessagePersistenceService;

  beforeEach(() => {
    service = new MessagePersistenceService();
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ error: null });
  });

  describe('saveMessage', () => {
    it('should save user message successfully', async () => {
      await service.saveMessage('Hello', 'user', 'conv-123', 'user-456');

      expect(mockFrom).toHaveBeenCalledWith('messages');
      expect(mockInsert).toHaveBeenCalledWith([
        {
          conversation_id: 'conv-123',
          user_id: 'user-456',
          role: 'user',
          content: 'Hello',
        },
      ]);
    });

    it('should save assistant message successfully', async () => {
      await service.saveMessage('Hi there!', 'assistant', 'conv-123', 'user-456');

      expect(mockInsert).toHaveBeenCalledWith([
        {
          conversation_id: 'conv-123',
          user_id: 'user-456',
          role: 'assistant',
          content: 'Hi there!',
        },
      ]);
    });

    it('should throw error on save failure', async () => {
      const error = new Error('Database error');
      mockInsert.mockReturnValue({ error });

      await expect(
        service.saveMessage('Hello', 'user', 'conv-123', 'user-456')
      ).rejects.toThrow('Database error');
    });
  });

  describe('trackCallMetering', () => {
    beforeEach(() => {
      mockFrom.mockReturnValue({
        insert: mockInsert,
      });
    });

    it('should track call metering successfully', async () => {
      await service.trackCallMetering('user-456', 120, 'studio');

      expect(mockFrom).toHaveBeenCalledWith('usage_logs');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-456',
          event: 'voice_call_completed',
          data: expect.objectContaining({
            feature: 'voice_call',
            tier: 'studio',
            duration_seconds: 120,
            tokens_used: 0,
            estimated_cost: expect.any(Number),
            cost_breakdown: expect.objectContaining({
              stt: expect.any(Number),
              tts: expect.any(Number),
              total: expect.any(Number),
            }),
          }),
          timestamp: expect.any(String),
          created_at: expect.any(String),
        })
      );
    });

    it('should calculate costs correctly', async () => {
      await service.trackCallMetering('user-456', 60, 'core');

      const insertCall = mockInsert.mock.calls[0][0];
      const costBreakdown = insertCall.data.cost_breakdown;

      // 60 seconds = 1 minute
      // STT: 1 min * $0.006/min = $0.006
      // TTS: 60 sec * 25 chars/sec = 1500 chars, 1500/1000 * $0.015 = $0.0225
      // Total: ~$0.0285
      expect(costBreakdown.stt).toBeCloseTo(0.006, 3);
      expect(costBreakdown.tts).toBeCloseTo(0.0225, 3);
      expect(costBreakdown.total).toBeCloseTo(0.0285, 3);
    });

    it('should throw error on metering failure', async () => {
      const error = new Error('Metering error');
      mockInsert.mockReturnValue({ error });

      await expect(
        service.trackCallMetering('user-456', 120, 'studio')
      ).rejects.toThrow('Metering error');
    });
  });
});

