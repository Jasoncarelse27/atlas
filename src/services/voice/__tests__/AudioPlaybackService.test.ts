/**
 * AudioPlaybackService Unit Tests
 * 
 * Tests for the extracted AudioPlaybackService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioPlaybackService } from '../AudioPlaybackService';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('AudioPlaybackService', () => {
  let service: AudioPlaybackService;

  beforeEach(() => {
    service = new AudioPlaybackService();
    // Clean up global state
    delete (window as any).__atlasAudioElement;
  });

  afterEach(() => {
    service.stop();
    delete (window as any).__atlasAudioElement;
  });

  describe('play', () => {
    it('should create and play audio element', async () => {
      const audioDataUrl = 'data:audio/mp3;base64,dGVzdA==';
      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        paused: false,
        currentTime: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        onloadeddata: null,
        onplay: null,
        onerror: null,
        onended: null,
      };

      // Mock Audio constructor
      global.Audio = vi.fn().mockImplementation(() => mockAudio) as any;

      const onPlay = vi.fn();
      await service.play(audioDataUrl, { onPlay });

      expect(global.Audio).toHaveBeenCalledWith(audioDataUrl);
      expect(mockAudio.play).toHaveBeenCalled();
      expect((window as any).__atlasAudioElement).toBe(mockAudio);
      
      // Simulate play event
      if (mockAudio.onplay) {
        mockAudio.onplay(new Event('play'));
      }
      expect(onPlay).toHaveBeenCalled();
    });

    it('should stop previous audio before playing new', async () => {
      const firstAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        paused: false,
        currentTime: 0,
        addEventListener: vi.fn(),
        onloadeddata: null,
        onplay: null,
        onerror: null,
        onended: null,
      };
      const secondAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        paused: false,
        currentTime: 0,
        addEventListener: vi.fn(),
        onloadeddata: null,
        onplay: null,
        onerror: null,
        onended: null,
      };

      let audioCallCount = 0;
      global.Audio = vi.fn().mockImplementation(() => {
        audioCallCount++;
        return audioCallCount === 1 ? firstAudio : secondAudio;
      }) as any;

      await service.play('data:audio/mp3;base64,first');
      await service.play('data:audio/mp3;base64,second');

      expect(firstAudio.pause).toHaveBeenCalled();
      expect(secondAudio.play).toHaveBeenCalled();
    });

    it('should call onPlay callback', async () => {
      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        paused: false,
        currentTime: 0,
        addEventListener: vi.fn(),
        onloadeddata: null,
        onplay: null,
        onerror: null,
        onended: null,
      };

      global.Audio = vi.fn().mockImplementation(() => mockAudio) as any;

      const onPlay = vi.fn();
      await service.play('data:audio/mp3;base64,test', { onPlay });

      // Simulate audio play event
      if (mockAudio.onplay) {
        mockAudio.onplay(new Event('play'));
      }

      expect(onPlay).toHaveBeenCalled();
    });

    it('should handle play errors', async () => {
      const mockAudio = {
        play: vi.fn().mockRejectedValue(new Error('Play failed')),
        pause: vi.fn(),
        paused: false,
        currentTime: 0,
        addEventListener: vi.fn(),
        onloadeddata: null,
        onplay: null,
        onerror: null,
        onended: null,
      };

      global.Audio = vi.fn().mockImplementation(() => mockAudio) as any;

      const onError = vi.fn();
      
      await expect(service.play('data:audio/mp3;base64,test', { onError })).rejects.toThrow('Play failed');
      
      // Error is thrown, so onError callback is called in the catch block
      // but since we're testing the error path, we verify cleanup happened
      expect((window as any).__atlasAudioElement).toBeUndefined();
    });
  });

  describe('stop', () => {
    it('should stop current audio', async () => {
      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        paused: false,
        currentTime: 0,
        addEventListener: vi.fn(),
        onloadeddata: null,
        onplay: null,
        onerror: null,
        onended: null,
      };

      global.Audio = vi.fn().mockImplementation(() => mockAudio) as any;

      await service.play('data:audio/mp3;base64,test');
      service.stop();

      expect(mockAudio.pause).toHaveBeenCalled();
      expect(service.getCurrentAudio()).toBeNull();
      expect((window as any).__atlasAudioElement).toBeUndefined();
    });

    it('should not throw if no audio is playing', () => {
      expect(() => service.stop()).not.toThrow();
    });
  });

  describe('isPlaying', () => {
    it('should return false when no audio', () => {
      expect(service.isPlaying()).toBe(false);
    });

    it('should return true when audio is playing', async () => {
      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        paused: false,
        currentTime: 0,
        addEventListener: vi.fn(),
        onloadeddata: null,
        onplay: null,
        onerror: null,
        onended: null,
      };

      global.Audio = vi.fn().mockImplementation(() => mockAudio) as any;

      await service.play('data:audio/mp3;base64,test');

      expect(service.isPlaying()).toBe(true);
    });
  });

  describe('getCurrentAudio', () => {
    it('should return null when no audio', () => {
      expect(service.getCurrentAudio()).toBeNull();
    });

    it('should return current audio element', async () => {
      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        paused: false,
        currentTime: 0,
        addEventListener: vi.fn(),
        onloadeddata: null,
        onplay: null,
        onerror: null,
        onended: null,
      };

      global.Audio = vi.fn().mockImplementation(() => mockAudio) as any;

      await service.play('data:audio/mp3;base64,test');

      expect(service.getCurrentAudio()).toBe(mockAudio);
    });
  });
});

