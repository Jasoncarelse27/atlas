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
  private onCompleteCallback?: () => void; // ✅ FIX: Callback when all audio completes
  
  /**
   * Add pre-generated audio directly to queue (for V2 WebSocket streaming)
   */
  addAudioDirectly(audio: HTMLAudioElement, index: number): void {
    const item: AudioQueueItem = {
      text: '', // No text needed for pre-generated audio
      index,
      audio,
      status: 'ready', // Already generated
    };
    
    // Insert at correct position (maintain order)
    this.queue.push(item);
    this.queue.sort((a, b) => a.index - b.index);
    
    logger.debug(`[AudioQueue] Added pre-generated audio at index ${index}`);
    
    // Start playback if not already playing
    if (!this.isPlaying && !this.isInterrupted) {
      this.startPlayback();
    }
  }
  
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
    
    // ✅ IMPROVEMENT: Generate TTS with retry logic
    this.generateTTSWithRetry(item, voice).catch(err => {
      logger.error(`[AudioQueue] TTS generation failed for sentence ${index} after retries:`, err);
      item.status = 'error';
    });
    
    // Start playback loop if not already playing
    if (!this.isPlaying && !this.isInterrupted) {
      this.startPlayback();
    }
  }
  
  /**
   * Generate TTS for a single sentence with retry logic
   * ✅ PRODUCTION-GRADE: Smart retry with error-aware backoff and fallback model
   */
  private async generateTTSWithRetry(item: AudioQueueItem, voice: string, retries = 3): Promise<void> {
    let model = 'tts-1-hd'; // Start with HD model
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await this.generateTTS(item, voice, model);
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;
        
        // ✅ Fallback to standard model on timeout/HD errors
        if (model === 'tts-1-hd' && (errorMessage.includes('timeout') || errorMessage.includes('504'))) {
          logger.warn(`[AudioQueue] HD model failed (${errorMessage}), falling back to standard model`);
          model = 'tts-1';
          continue; // Retry immediately with fallback model
        }
        
        // ✅ Don't retry on auth errors (401/403)
        if (errorMessage.includes('401') || errorMessage.includes('403')) {
          logger.error(`[AudioQueue] TTS auth error - not retrying: ${errorMessage}`);
          item.status = 'error';
          throw lastError;
        }
        
        // ✅ Don't retry on client errors (400/422)
        if (errorMessage.includes('400') || errorMessage.includes('422')) {
          logger.error(`[AudioQueue] TTS client error - not retrying: ${errorMessage}`);
          item.status = 'error';
          throw lastError;
        }
        
        if (attempt === retries - 1) {
          // Final attempt failed
          logger.error(`[AudioQueue] TTS failed after ${retries} attempts for sentence ${item.index}:`, lastError);
          item.status = 'error';
          throw lastError;
        }
        
        // ✅ Smart retry delay based on error type
        let delay: number;
        if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          delay = 60000; // Wait 1 minute for rate limits
        } else if (errorMessage.includes('timeout') || errorMessage.includes('504')) {
          delay = 2000; // Quick retry for timeouts (2s)
        } else {
          delay = 1000 * Math.pow(2, attempt); // Exponential backoff: 1s, 2s, 4s
        }
        
        logger.warn(`[AudioQueue] TTS attempt ${attempt + 1}/${retries} failed (${errorMessage}), retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    
    // Should never reach here, but TypeScript needs it
    if (lastError) throw lastError;
  }
  
  /**
   * Generate TTS for a single sentence
   * ✅ PRODUCTION-GRADE: Request ID tracking, enhanced error handling
   */
  private async generateTTS(item: AudioQueueItem, voice: string, model: string = 'tts-1-hd'): Promise<void> {
    item.status = 'generating';
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const requestId = crypto.randomUUID(); // ✅ Track requests for debugging
      
      const response = await fetch(`${supabaseUrl}/functions/v1/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'X-Request-ID': requestId, // ✅ Request tracking
        },
        body: JSON.stringify({
          text: item.text,
          voice,
          model,
          speed: 1.05, // 🎯 Slightly faster for more natural conversation pace
        }),
      });
      
      if (!response.ok) {
        let errorDetails: any;
        try {
          errorDetails = await response.json();
        } catch {
          errorDetails = { error: response.statusText };
        }
        
        // ✅ Enhanced error with details from server
        const errorMessage = errorDetails.details || errorDetails.error || response.statusText;
        const error = new Error(`TTS failed: ${errorMessage}`);
        (error as any).code = response.status;
        (error as any).retryable = errorDetails.retryable !== false; // Default to retryable unless explicitly false
        (error as any).requestId = errorDetails.requestId || requestId;
        throw error;
      }
      
      const result = await response.json();
      const audioDataUrl = `data:audio/mp3;base64,${result.base64Audio}`;
      
      const audio = new Audio(audioDataUrl);
      item.audio = audio;
      item.status = 'ready';
      
      // ✅ Log model used (may differ if fallback occurred)
      const actualModel = result.model || model;
      logger.debug(`[AudioQueue] TTS ready for sentence ${item.index} (model: ${actualModel}, requestId: ${result.requestId || requestId})`);
    } catch (error) {
      logger.error(`[AudioQueue] TTS generation error for sentence ${item.index}:`, error);
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
      
      // ✅ FIX: Wait for TTS with shorter timeout (voice calls need low latency)
      // ChatGPT starts speaking as soon as first TTS is ready
      // ✅ IMPROVEMENT: Longer timeout when resuming (TTS might still be generating)
      const isResuming = this.isInterrupted === false && this.currentIndex > 0; // Resuming if not interrupted but already started
      const timeout = isResuming ? 10000 : 5000; // 10s when resuming, 5s for new playback
      const startWait = Date.now();
      while (item.status !== 'ready' && item.status !== 'error') {
        if (Date.now() - startWait > timeout) {
          logger.error(`[AudioQueue] Timeout waiting for sentence ${item.index} after ${timeout/1000}s (${isResuming ? 'resuming' : 'new playback'})`);
          item.status = 'error';
          break;
        }
        await new Promise(r => setTimeout(r, 50)); // ✅ FIX: Check every 50ms (was 100ms) for faster start
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
        
        // ✅ FIX: Check if audio was paused (from interrupt) and resume from current position
        if (item.audio && item.audio.paused && item.audio.currentTime > 0) {
          logger.debug(`[AudioQueue] Resuming sentence ${item.index} from ${item.audio.currentTime.toFixed(2)}s`);
        } else {
        logger.debug(`[AudioQueue] Playing sentence ${item.index}`);
        }
        
        await new Promise<void>((resolve, reject) => {
          if (!item.audio) {
            reject(new Error('Audio is null'));
            return;
          }
          
          // ✅ FIX: Remove old listeners to prevent duplicates
          item.audio.onended = null;
          item.audio.onerror = null;
          
          item.audio.onended = () => resolve();
          item.audio.onerror = (e) => reject(e);
          item.audio.play().catch(reject);
        });
        
        item.status = 'played';
      } catch (error) {
        logger.error(`[AudioQueue] Playback error for sentence ${item.index}:`, error);
        item.status = 'error';
      }
      
      // ✅ FIX: Add minimal pause between sentences for smoother playback
      if (this.currentIndex < this.queue.length - 1 && !this.isInterrupted) {
        await new Promise(r => setTimeout(r, 50)); // ✅ FIX: Reduced from 150ms to 50ms for smoother audio
      }
      
      this.currentIndex++;
    }
    
    this.isPlaying = false;
    this.isInterrupted = false; // ✅ FIX: Reset interrupt flag - ready for next input
    logger.info('[AudioQueue] Playback loop ended - ready for next input');
    
    // ✅ FIX: Notify when all audio completes (only if not interrupted)
    if (this.onCompleteCallback && !this.isInterrupted) {
      this.onCompleteCallback();
    }
  }
  
  /**
   * Interrupt playback immediately (pause but don't clear queue - allows resume)
   */
  interrupt(): void {
    logger.info('[AudioQueue] 🛑 Interrupting playback (pausing for potential resume)');
    this.isInterrupted = true;
    this.isPlaying = false;
    
    // ✅ FIX: Stop ALL audio in queue immediately (not just current)
    this.queue.forEach((item, index) => {
      if (item.audio && !item.audio.paused) {
        item.audio.pause();
        // ✅ FIX: Don't reset currentTime - allows resume from same position
        logger.debug(`[AudioQueue] Paused audio for sentence ${index}`);
      }
    });
    
    // ✅ FIX: Don't clear queue - allows resume if user stops speaking
  }
  
  /**
   * Resume playback from where it was interrupted
   */
  resume(): void {
    if (this.queue.length === 0) {
      logger.debug('[AudioQueue] Nothing to resume - queue is empty');
      return;
    }
    
    logger.info(`[AudioQueue] ▶️ Resuming playback from interruption (${this.queue.length} items, currentIndex: ${this.currentIndex})`);
    this.isInterrupted = false;
    
    // ✅ CRITICAL FIX: Resume playback to ensure Atlas completes interrupted response
    // If current item is paused, resume it directly; otherwise restart playback loop
    if (this.currentIndex < this.queue.length) {
      const currentItem = this.queue[this.currentIndex];
      
      // If current item exists and is paused, resume it directly
      if (currentItem.audio && currentItem.audio.paused && currentItem.audio.currentTime > 0) {
        logger.debug(`[AudioQueue] Resuming paused audio at index ${this.currentIndex} from ${currentItem.audio.currentTime.toFixed(2)}s`);
        this.isPlaying = true; // Mark as playing since we're resuming
        currentItem.audio.play().catch(err => {
          logger.error(`[AudioQueue] Error resuming audio ${this.currentIndex}:`, err);
          this.isPlaying = false;
        });
        // Playback loop will continue via onended event
      } else if (!this.isPlaying) {
        // If not playing, start playback loop from current position
        this.startPlayback();
      }
      // If already playing and not paused, do nothing (already playing)
    }
  }
  
  /**
   * Reset for next conversation (clear everything)
   */
  reset(): void {
    logger.info('[AudioQueue] 🔄 Resetting queue for new conversation');
    this.isInterrupted = true;
    this.isPlaying = false;
    
    // Stop all audio
    this.queue.forEach((item) => {
      if (item.audio && !item.audio.paused) {
        item.audio.pause();
        item.audio.currentTime = 0;
      }
    });
    
    // Clear queue completely
    this.queue = [];
    this.currentIndex = 0;
    this.isInterrupted = false;
    this.onCompleteCallback = undefined; // ✅ FIX: Clear callback on reset
  }
  
  /**
   * Set callback to be called when all audio playback completes
   */
  setOnComplete(callback: () => void): void {
    this.onCompleteCallback = callback;
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

