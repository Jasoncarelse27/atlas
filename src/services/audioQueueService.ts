/**
 * Audio Queue Service - Progressive Audio Playback
 * Plays TTS audio as sentences arrive from streaming API
 */

import { supabase } from '@/lib/supabaseClient';
import { logger } from '../lib/logger';

interface AudioQueueItem {
  text: string;
  index: number;
  audio: HTMLAudioElement | null;
  status: 'pending' | 'generating' | 'ready' | 'playing' | 'played' | 'error';
}

export class AudioQueueService {
  private queue: AudioQueueItem[] = [];
  private isPlaying: boolean = false;
  private currentIndex: number = 0;
  private isInterrupted: boolean = false;
  
  /**
   * Add a sentence to the queue and start generating TTS immediately
   */
  async addSentence(text: string, index: number, voice: string = 'nova'): Promise<void> {
    const item: AudioQueueItem = {
      text,
      index,
      audio: null,
      status: 'pending',
    };
    
    this.queue.push(item);
    logger.debug(`[AudioQueue] Added sentence ${index}: "${text.substring(0, 50)}..."`);
    
    // Start generating TTS immediately (parallel)
    this.generateTTS(item, voice).catch(err => {
      logger.error(`[AudioQueue] TTS generation failed for sentence ${index}:`, err);
      item.status = 'error';
    });
    
    // Start playback loop if not already playing
    if (!this.isPlaying && !this.isInterrupted) {
      this.startPlayback();
    }
  }
  
  /**
   * Generate TTS for a single sentence
   */
  private async generateTTS(item: AudioQueueItem, voice: string): Promise<void> {
    item.status = 'generating';
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          text: item.text,
          voice,
          model: 'tts-1-hd',
          speed: 1.05, // 🎯 Slightly faster for more natural conversation pace
        }),
      });
      
      if (!response.ok) {
        throw new Error(`TTS failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      const audioDataUrl = `data:audio/mp3;base64,${result.base64Audio}`;
      
      const audio = new Audio(audioDataUrl);
      item.audio = audio;
      item.status = 'ready';
      
      logger.debug(`[AudioQueue] TTS ready for sentence ${item.index}`);
    } catch (error) {
      logger.error(`[AudioQueue] TTS generation error:`, error);
      item.status = 'error';
      throw error;
    }
  }
  
  /**
   * Playback loop - plays audio sentences in order
   */
  private async startPlayback(): Promise<void> {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    logger.info('[AudioQueue] Starting playback loop');
    
    while (this.currentIndex < this.queue.length && !this.isInterrupted) {
      const item = this.queue[this.currentIndex];
      
      // Wait for TTS to be ready (with timeout)
      const startWait = Date.now();
      while (item.status !== 'ready' && item.status !== 'error') {
        if (Date.now() - startWait > 30000) { // 🚀 Increased from 10s to 30s for slower networks
          logger.error(`[AudioQueue] Timeout waiting for sentence ${item.index} after 30s`);
          item.status = 'error';
          break;
        }
        await new Promise(r => setTimeout(r, 100));
      }
      
      // Skip if error
      if (item.status === 'error' || !item.audio) {
        logger.warn(`[AudioQueue] Skipping sentence ${item.index} (error)`);
        this.currentIndex++;
        continue;
      }
      
      // Play audio
      try {
        item.status = 'playing';
        logger.debug(`[AudioQueue] Playing sentence ${item.index}`);
        
        await new Promise<void>((resolve, reject) => {
          if (!item.audio) {
            reject(new Error('Audio is null'));
            return;
          }
          
          item.audio.onended = () => resolve();
          item.audio.onerror = (e) => reject(e);
          item.audio.play().catch(reject);
        });
        
        item.status = 'played';
      } catch (error) {
        logger.error(`[AudioQueue] Playback error for sentence ${item.index}:`, error);
        item.status = 'error';
      }
      
      this.currentIndex++;
    }
    
    this.isPlaying = false;
    this.isInterrupted = false; // ✅ FIX: Reset interrupt flag - ready for next input
    logger.info('[AudioQueue] Playback loop ended - ready for next input');
  }
  
  /**
   * Interrupt playback immediately
   */
  interrupt(): void {
    logger.info('[AudioQueue] 🛑 Interrupting playback and clearing queue');
    this.isInterrupted = true;
    this.isPlaying = false;
    
    // ✅ FIX: Stop ALL audio in queue immediately (not just current)
    this.queue.forEach((item, index) => {
      if (item.audio && !item.audio.paused) {
        item.audio.pause();
        item.audio.currentTime = 0;
        logger.debug(`[AudioQueue] Stopped audio for sentence ${index}`);
      }
    });
    
    // Clear queue
    this.queue = [];
    this.currentIndex = 0;
  }
  
  /**
   * Reset for next conversation
   */
  reset(): void {
    this.interrupt();
    this.isInterrupted = false;
  }
  
  /**
   * Check if audio is currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }
  
  /**
   * Get current playback status
   */
  getStatus(): { isPlaying: boolean; currentIndex: number; queueLength: number } {
    return {
      isPlaying: this.isPlaying,
      currentIndex: this.currentIndex,
      queueLength: this.queue.length,
    };
  }
}

export const audioQueueService = new AudioQueueService();

