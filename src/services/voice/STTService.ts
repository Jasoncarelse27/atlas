/**
 * Speech-to-Text Service
 * 
 * Handles Deepgram STT API calls with confidence checking and retry logic.
 * Extracted from voiceCallService.ts for better separation of concerns.
 * 
 * Created: 2025-01-01
 */

import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import type { ISTTService, STTServiceConfig } from './interfaces';
import { RetryService } from './RetryService';
import { isFeatureEnabled } from '@/config/featureFlags';

export interface STTServiceCallbacks {
  onTranscribed?: (text: string, confidence: number) => void;
  onRetry?: (attempt: number, maxRetries: number) => void;
  onError?: (error: Error) => void;
}

export class STTService implements ISTTService {
  private config: STTServiceConfig;
  private retryService: RetryService;
  private readonly MIN_CONFIDENCE = 0.2; // 20% threshold (ChatGPT standard)
  private readonly MIN_TRANSCRIPT_LENGTH = 2;

  constructor(config: Partial<STTServiceConfig> = {}) {
    this.config = {
      minConfidence: config.minConfidence ?? this.MIN_CONFIDENCE,
      minTranscriptLength: config.minTranscriptLength ?? this.MIN_TRANSCRIPT_LENGTH,
      timeout: config.timeout ?? 15000,
      ...config,
    };
    this.retryService = new RetryService();
  }

  /**
   * Transcribe audio blob to text
   */
  async transcribe(
    audioBlob: Blob,
    callbacks?: STTServiceCallbacks
  ): Promise<string> {
    // Validate blob size
    if (audioBlob.size < 8 * 1024) {
      throw new Error('Audio too small - likely silence');
    }

    const base64Audio = await this.blobToBase64(audioBlob);
    const { data: { session } } = await supabase.auth.getSession();

    const fetchStart = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const sttResponse = await fetch('/api/stt-deepgram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          audio: base64Audio.split(',')[1], // Remove data:audio/webm;base64, prefix
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      logger.info(`[STT] ⏱️ Fetch: ${(performance.now() - fetchStart).toFixed(0)}ms`);

      if (!sttResponse.ok) {
        const error = await sttResponse.text();
        throw new Error(`STT failed: ${error}`);
      }

      const result = await sttResponse.json();
      const confidence = result.confidence || 0;
      const text = result.text || '';

      logger.info(`[STT] 📊 Confidence: ${(confidence * 100).toFixed(1)}%`);

      // Validate confidence
      if (confidence < this.config.minConfidence) {
        const confidencePercent = (confidence * 100).toFixed(1);
        const noiseType = confidence === 0 ? 'silence' : confidence < 0.05 ? 'background noise' : confidence < 0.1 ? 'cough/sneeze' : 'unclear audio';
        logger.warn(`[STT] ❌ Low confidence (${confidencePercent}%) - rejecting as ${noiseType}`);

        // Fail fast for 0.0% confidence
        if (confidence === 0 || confidencePercent === '0.0') {
          logger.debug('[STT] ⚡ 0.0% confidence - failing fast (no retries)');
          throw new Error(`STT confidence too low (0.0%) - likely silence or noise`);
        }

        throw new Error(`STT confidence too low (${confidencePercent}%) - likely silence or noise`);
      }

      // Validate transcript length
      if (!text || text.trim().length < this.config.minTranscriptLength) {
        logger.debug('[STT] ❌ Empty or too short transcript - rejecting');
        throw new Error('Transcript too short - likely noise');
      }

      // Warn for medium-low confidence
      if (confidence < 0.5) {
        logger.warn(`[STT] ⚠️ Low confidence (${(confidence * 100).toFixed(1)}%). Audio may be unclear.`);
      }

      callbacks?.onTranscribed?.(text, confidence);
      return text;
    } catch (error) {
      clearTimeout(timeout);
      const errorMessage = error instanceof Error ? error.message : 'STT failed';
      
      // Fail fast for 0.0% confidence
      if (errorMessage.includes('0.0%')) {
        callbacks?.onError?.(error as Error);
        throw error;
      }

      // Use retry service for other errors
      if (isFeatureEnabled('USE_RETRY_SERVICE')) {
        return this.retryService.withBackoff(
          () => this.transcribe(audioBlob, callbacks),
          'Speech-to-Text',
          {
            onRetry: (attempt, maxRetries) => {
              callbacks?.onRetry?.(attempt, maxRetries);
            },
            onError: (err) => {
              callbacks?.onError?.(err);
            },
          }
        );
      }

      callbacks?.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Convert blob to base64
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

