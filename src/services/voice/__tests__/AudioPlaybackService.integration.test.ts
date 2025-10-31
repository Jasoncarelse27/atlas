/**
 * AudioPlaybackService Integration Tests
 * 
 * Tests audio playback in standard (non-streaming) mode
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

// Mock Audio
global.Audio = vi.fn().mockImplementation(() => {
  const audio = {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    currentTime: 0,
    paused: false,
    onloadeddata: null as (() => void) | null,
    onplay: null as (() => void) | null,
    onerror: null as ((e: Event) => void) | null,
    onended: null as (() => void) | null,
  };
  return audio;
}) as any;

describe('AudioPlaybackService Integration', () => {
  let service: AudioPlaybackService;

  beforeEach(() => {
    service = new AudioPlaybackService();
    vi.clearAllMocks();
    // Clear global state
    delete (window as any).__atlasAudioElement;
  });

  afterEach(() => {
    service.stop();
    delete (window as any).__atlasAudioElement;
  });

  describe('Playback Lifecycle', () => {
    it('should play audio and set global state', async () => {
      const audioDataUrl = 'data:audio/mp3;base64,test';
      const onPlay = vi.fn();
      const onEnded = vi.fn();

      await service.play(audioDataUrl, { onPlay, onEnded });

      expect((window as any).__atlasAudioElement).toBeDefined();
      expect(service.isPlaying()).toBe(true);
    });

    it('should stop current audio before playing new', async () => {
      const audioDataUrl1 = 'data:audio/mp3;base64,test1';
      const audioDataUrl2 = 'data:audio/mp3;base64,test2';

      await service.play(audioDataUrl1);
      const firstAudio = service.getCurrentAudio();

      await service.play(audioDataUrl2);
      const secondAudio = service.getCurrentAudio();

      // Should have stopped first audio
      expect(firstAudio?.pause).toHaveBeenCalled();
      expect(secondAudio).not.toBe(firstAudio);
    });

    it('should handle playback errors gracefully', async () => {
      const audioDataUrl = 'data:audio/mp3;base64,invalid';
      const onError = vi.fn();

      // Mock audio to throw error
      const mockAudio = {
        play: vi.fn().mockRejectedValue(new Error('Playback failed')),
        pause: vi.fn(),
        currentTime: 0,
        paused: false,
        onloadeddata: null,
        onplay: null,
        onerror: null,
        onended: null,
      };

      (global.Audio as any).mockReturnValueOnce(mockAudio);

      await expect(service.play(audioDataUrl, { onError })).rejects.toThrow();

      // Should cleanup global state
      expect((window as any).__atlasAudioElement).toBeUndefined();
    });

    it('should call callbacks correctly', async () => {
      const audioDataUrl = 'data:audio/mp3;base64,test';
      const onPlay = vi.fn();
      const onEnded = vi.fn();
      const onError = vi.fn();

      const mockAudio = {
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        currentTime: 0,
        paused: false,
        onloadeddata: null,
        onplay: null as (() => void) | null,
        onerror: null as ((e: Event) => void) | null,
        onended: null as (() => void) | null,
      };

      (global.Audio as any).mockReturnValueOnce(mockAudio);

      const promise = service.play(audioDataUrl, { onPlay, onEnded, onError });

      // Simulate audio events
      if (mockAudio.onplay) mockAudio.onplay();
      if (mockAudio.onended) mockAudio.onended();

      await promise;

      expect(onPlay).toHaveBeenCalled();
      expect(onEnded).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup global state on stop', async () => {
      const audioDataUrl = 'data:audio/mp3;base64,test';
      await service.play(audioDataUrl);

      expect((window as any).__atlasAudioElement).toBeDefined();

      service.stop();

      expect((window as any).__atlasAudioElement).toBeUndefined();
      expect(service.getCurrentAudio()).toBeNull();
    });

    it('should cleanup on error', async () => {
      const audioDataUrl = 'data:audio/mp3;base64,invalid';
      const mockAudio = {
        play: vi.fn().mockRejectedValue(new Error('Error')),
        pause: vi.fn(),
        currentTime: 0,
        paused: false,
        onloadeddata: null,
        onplay: null,
        onerror: null,
        onended: null,
      };

      (global.Audio as any).mockReturnValueOnce(mockAudio);
      (window as any).__atlasAudioElement = mockAudio;

      try {
        await service.play(audioDataUrl);
      } catch (e) {
        // Expected
      }

      expect((window as any).__atlasAudioElement).toBeUndefined();
    });
  });

  describe('State Management', () => {
    it('should correctly report playing state', async () => {
      expect(service.isPlaying()).toBe(false);

      const audioDataUrl = 'data:audio/mp3;base64,test';
      await service.play(audioDataUrl);

      expect(service.isPlaying()).toBe(true);

      service.stop();

      expect(service.isPlaying()).toBe(false);
    });

    it('should return current audio element', async () => {
      const audioDataUrl = 'data:audio/mp3;base64,test';
      await service.play(audioDataUrl);

      const audio = service.getCurrentAudio();
      expect(audio).toBeDefined();
    });
  });
});

