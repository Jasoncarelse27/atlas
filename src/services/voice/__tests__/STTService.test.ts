/**
 * STTService Unit Tests
 * 
 * Tests for the extracted STTService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STTService } from '../STTService';

// Mock fetch
global.fetch = vi.fn();

// Mock Supabase
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: { access_token: 'test-token' },
        },
      }),
    },
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

// Mock feature flags
vi.mock('@/config/featureFlags', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(false),
}));

describe('STTService', () => {
  let service: STTService;

  beforeEach(() => {
    service = new STTService({ timeout: 5000 });
    vi.clearAllMocks();
  });

  describe('transcribe', () => {
    it('should reject audio blob that is too small', async () => {
      const smallBlob = new Blob(['test'], { type: 'audio/webm' });
      // Mock small size
      Object.defineProperty(smallBlob, 'size', { value: 1024 });

      await expect(service.transcribe(smallBlob)).rejects.toThrow(
        'Audio too small'
      );
    });

    it('should transcribe audio successfully', async () => {
      const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
      Object.defineProperty(audioBlob, 'size', { value: 10000 });

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          text: 'Hello world',
          confidence: 0.95,
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await service.transcribe(audioBlob);

      expect(result).toBe('Hello world');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/stt-deepgram',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should reject low confidence results', async () => {
      const audioBlob = new Blob(['test'], { type: 'audio/webm' });
      Object.defineProperty(audioBlob, 'size', { value: 10000 });

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          text: 'test',
          confidence: 0.1, // Below 0.2 threshold
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await expect(service.transcribe(audioBlob)).rejects.toThrow(
        'STT confidence too low'
      );
    });

    it('should reject 0.0% confidence immediately', async () => {
      const audioBlob = new Blob(['test'], { type: 'audio/webm' });
      Object.defineProperty(audioBlob, 'size', { value: 10000 });

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          text: 'test',
          confidence: 0.0,
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await expect(service.transcribe(audioBlob)).rejects.toThrow(
        'STT confidence too low (0.0%)'
      );
    });

    it('should reject empty transcripts', async () => {
      const audioBlob = new Blob(['test'], { type: 'audio/webm' });
      Object.defineProperty(audioBlob, 'size', { value: 10000 });

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          text: '',
          confidence: 0.9,
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await expect(service.transcribe(audioBlob)).rejects.toThrow(
        'Transcript too short'
      );
    });

    it('should call onTranscribed callback', async () => {
      const audioBlob = new Blob(['test'], { type: 'audio/webm' });
      Object.defineProperty(audioBlob, 'size', { value: 10000 });

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          text: 'Hello',
          confidence: 0.9,
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const onTranscribed = vi.fn();
      await service.transcribe(audioBlob, { onTranscribed });

      expect(onTranscribed).toHaveBeenCalledWith('Hello', 0.9);
    });

    it('should handle API errors', async () => {
      const audioBlob = new Blob(['test'], { type: 'audio/webm' });
      Object.defineProperty(audioBlob, 'size', { value: 10000 });

      const mockResponse = {
        ok: false,
        text: vi.fn().mockResolvedValue('API Error'),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await expect(service.transcribe(audioBlob)).rejects.toThrow(
        'STT failed'
      );
    });
  });
});

