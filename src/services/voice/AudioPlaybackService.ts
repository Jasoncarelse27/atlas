/**
 * Audio Playback Service
 * 
 * Manages audio element playback for voice calls.
 * Extracted from voiceCallService.ts for better separation of concerns.
 * 
 * Created: 2025-01-01
 */

import { logger } from '@/lib/logger';
import type {
  AudioPlaybackServiceCallbacks,
  AudioPlaybackService as IAudioPlaybackService,
} from './interfaces';

export class AudioPlaybackService implements IAudioPlaybackService {
  private currentAudio: HTMLAudioElement | null = null;

  /**
   * Play audio from base64 data URL
   */
  async play(
    audioDataUrl: string,
    callbacks?: AudioPlaybackServiceCallbacks
  ): Promise<void> {
    // Stop any currently playing audio
    this.stop();

    const audio = new Audio(audioDataUrl);
    this.currentAudio = audio;

    // Set global state for external access (if needed)
    (window as any).__atlasAudioElement = audio;

    audio.onloadeddata = () => logger.debug('[AudioPlayback] Audio data loaded');
    audio.onplay = () => {
      logger.info('[AudioPlayback] ✅ Audio playing');
      callbacks?.onPlay?.();
    };
    audio.onerror = (e) => {
      logger.error('[AudioPlayback] Audio error:', e);
      // Cleanup global state on error
      delete (window as any).__atlasAudioElement;
      if (this.currentAudio === audio) {
        this.currentAudio = null;
      }
      callbacks?.onError?.(new Error('Audio playback failed'));
    };
    audio.onended = () => {
      logger.debug('[AudioPlayback] Audio playback ended');
      delete (window as any).__atlasAudioElement;
      if (this.currentAudio === audio) {
        this.currentAudio = null;
      }
      callbacks?.onEnded?.();
    };

    try {
      await audio.play();
      logger.info('[AudioPlayback] ✅ Audio playback started successfully');
    } catch (error) {
      logger.error('[AudioPlayback] Error starting playback:', error);
      // Cleanup global state on error
      if ((window as any).__atlasAudioElement) {
        delete (window as any).__atlasAudioElement;
      }
      if (this.currentAudio === audio) {
        this.currentAudio = null;
      }
      throw error;
    }
  }

  /**
   * Stop current audio playback
   */
  stop(): void {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }
    
    // Cleanup global state
    if ((window as any).__atlasAudioElement) {
      delete (window as any).__atlasAudioElement;
    }
    
    this.currentAudio = null;
  }

  /**
   * Check if audio is currently playing
   */
  isPlaying(): boolean {
    return this.currentAudio !== null && !this.currentAudio.paused;
  }

  /**
   * Get current audio element (for external control)
   */
  getCurrentAudio(): HTMLAudioElement | null {
    return this.currentAudio;
  }
}

