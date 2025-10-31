/**
 * TTSService Unit Tests
 * 
 * Tests for the extracted TTSService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TTSService } from '../TTSService';

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

// Note: import.meta.env is read at module load time, so we test with actual URL
// but verify the endpoint path instead of full URL

describe('TTSService', () => {
  let service: TTSService;

  beforeEach(() => {
    service = new TTSService({
      voice: 'alloy',
      model: 'tts-1',
      speed: 1.0,
    });
    vi.clearAllMocks();
  });

  describe('synthesize', () => {
    it('should synthesize speech successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          base64Audio: 'dGVzdGF1ZGlv',
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await service.synthesize('Hello world');

      expect(result).toBe('data:audio/mp3;base64,dGVzdGF1ZGlv');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/tts'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
          body: JSON.stringify({
            text: 'Hello world',
            voice: 'alloy',
            model: 'tts-1',
            speed: 1.0,
          }),
        })
      );
    });

    it('should trim text before sending', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          base64Audio: 'dGVzdA==',
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await service.synthesize('  Hello world  ');

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.text).toBe('Hello world');
    });

    it('should call onSynthesized callback', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          base64Audio: 'dGVzdA==',
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const onSynthesized = vi.fn();
      await service.synthesize('Hello', { onSynthesized });

      expect(onSynthesized).toHaveBeenCalledWith(
        'data:audio/mp3;base64,dGVzdA=='
      );
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'TTS Service Error',
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await expect(service.synthesize('Hello')).rejects.toThrow(
        'TTS failed'
      );
    });

    it('should use custom config', async () => {
      const customService = new TTSService({
        voice: 'nova',
        model: 'tts-1-hd',
        speed: 1.2,
      });

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          base64Audio: 'dGVzdA==',
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await customService.synthesize('Hello');

      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[0]).toContain('/functions/v1/tts');
      const body = JSON.parse(callArgs[1].body);
      expect(body).toEqual({
        text: 'Hello',
        voice: 'nova',
        model: 'tts-1-hd',
        speed: 1.2,
      });
    });
  });
});

