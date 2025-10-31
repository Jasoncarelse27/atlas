/**
 * Retry Service
 * 
 * Provides exponential backoff retry logic with jitter.
 * Extracted from voiceCallService.ts for reusability.
 * 
 * Created: 2025-01-01
 */

import { logger } from '@/lib/logger';
import type {
  RetryServiceConfig,
  RetryServiceCallbacks,
  RetryService as IRetryService,
} from './interfaces';

export class RetryService implements IRetryService {
  private config: RetryServiceConfig;

  constructor(config: Partial<RetryServiceConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 5,
      retryDelays: config.retryDelays ?? [1000, 2000, 4000, 8000, 10000],
      jitterPercent: config.jitterPercent ?? 0.3,
    };
  }

  /**
   * Execute function with exponential backoff retry
   */
  async withBackoff<T>(
    fn: () => Promise<T>,
    operation: string,
    callbacks?: RetryServiceCallbacks
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Notify callbacks about retry
          callbacks?.onRetry?.(attempt, this.config.maxRetries);
          
          // Calculate delay with jitter
          const baseDelay = this.config.retryDelays[attempt - 1] || this.config.retryDelays[this.config.retryDelays.length - 1];
          const jitter = Math.random() * this.config.jitterPercent * baseDelay; // ±jitterPercent jitter
          const delay = baseDelay + jitter;
          
          logger.info(`[RetryService] Retry attempt ${attempt}/${this.config.maxRetries} for ${operation} (delay: ${delay.toFixed(0)}ms)`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        return await fn();
      } catch (error: unknown) {
        lastError = error as Error;
        
        // Notify callbacks about error
        callbacks?.onError?.(lastError, attempt);
        
        // Don't retry auth errors or rate limits
        if (lastError.message?.includes('401') || 
            lastError.message?.includes('403') || 
            lastError.message?.includes('429')) {
          throw lastError;
        }
        
        // Don't retry 0.0% confidence errors - it's wasted time
        // 0.0% confidence means silence/noise, retrying won't help
        if (lastError.message?.includes('confidence too low') && 
            lastError.message?.includes('0.0%')) {
          logger.debug('[RetryService] ⚡ Skipping retries for 0.0% confidence (silence/noise)');
          throw lastError; // Fail fast - no retries
        }
        
        if (attempt === this.config.maxRetries - 1) {
          // Final attempt failed
          // Preserve original error message for low confidence/empty transcript
          // This allows resume logic to work after retries fail
          if (lastError?.message?.includes('confidence too low') || 
              lastError?.message?.includes('too short')) {
            throw lastError; // Preserve original error for resume logic
          }
          throw new Error(`Connection lost. Please check your internet connection.`);
        }
      }
    }
    
    throw lastError || new Error(`${operation} failed`);
  }
}

