/**
 * Unit Tests - Audio Usage Service
 * Smoke tests to verify audio tracking methods work
 * 
 * Note: Full integration testing would require real Supabase
 * These tests verify the service interface and basic error handling
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioUsageService } from '../audioUsageService';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Audio Usage Service - Smoke Tests', () => {
  let audioService: AudioUsageService;

  beforeEach(() => {
    audioService = new AudioUsageService();
  });

  describe('checkAudioUsage()', () => {
    it('should return valid AudioUsageCheck structure', async () => {
      const result = await audioService.checkAudioUsage('user-test', 'core');

      expect(result).toBeDefined();
      expect(typeof result.canUse).toBe('boolean');
      expect(typeof result.minutesUsed).toBe('number');
      expect(typeof result.minutesRemaining).toBe('number');
      expect(typeof result.dailyUsed).toBe('number');
      expect(typeof result.dailyRemaining).toBe('number');
    });

    it('should handle free tier', async () => {
      const result = await audioService.checkAudioUsage('user-free', 'free');

      expect(result.canUse).toBe(false);
      expect(result.warning).toBeDefined();
    });

    it('should handle core tier', async () => {
      const result = await audioService.checkAudioUsage('user-core', 'core');

      expect(result).toBeDefined();
    });

    it('should handle studio tier', async () => {
      const result = await audioService.checkAudioUsage('user-studio', 'studio');

      expect(result).toBeDefined();
    });
  });

  describe('trackUsage()', () => {
    it('should execute STT tracking without errors', async () => {
      await expect(
        audioService.trackUsage('user-test', 'core', 'stt', 60)
      ).resolves.not.toThrow();
    });

    it('should execute TTS tracking without errors', async () => {
      await expect(
        audioService.trackUsage('user-test', 'core', 'tts', undefined, 300)
      ).resolves.not.toThrow();
    });

    it('should handle free tier gracefully', async () => {
      // Free tier should be blocked but not throw
      await expect(
        audioService.trackUsage('user-free', 'free', 'stt', 60)
      ).resolves.not.toThrow();
    });
  });

  describe('getCachedAudio()', () => {
    it('should return string or null', async () => {
      const result = await audioService.getCachedAudio('test text', 'tts-1');

      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should handle errors gracefully', async () => {
      await expect(
        audioService.getCachedAudio('', '')
      ).resolves.not.toThrow();
    });
  });
});
