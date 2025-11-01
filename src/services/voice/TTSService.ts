/**
 * Text-to-Speech Service
 * 
 * Handles OpenAI TTS API calls for voice synthesis.
 * Extracted from voiceCallService.ts for better separation of concerns.
 * 
 * Created: 2025-01-01
 */

import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import type { ITTSService, TTSServiceConfig } from './interfaces';
import { RetryService } from './RetryService';
import { isFeatureEnabled } from '@/config/featureFlags';

export interface TTSServiceCallbacks {
  onSynthesized?: (audioDataUrl: string) => void;
  onRetry?: (attempt: number, maxRetries: number) => void;
  onError?: (error: Error) => void;
}

export class TTSService implements ITTSService {
  private config: TTSServiceConfig;
  private retryService: RetryService;

  constructor(config: Partial<TTSServiceConfig> = {}) {
    this.config = {
      voice: config.voice ?? 'alloy',
      model: config.model ?? 'tts-1',
      speed: config.speed ?? 1.0,
      ...config,
    };
    this.retryService = new RetryService();
  }

  /**
   * Synthesize speech from text
   */
  async synthesize(
    text: string,
    callbacks?: TTSServiceCallbacks
  ): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    try {
      const requestId = crypto.randomUUID(); // ✅ Track requests for debugging
      let model = this.config.model || 'tts-1';
      
      const response = await fetch(`${supabaseUrl}/functions/v1/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'X-Request-ID': requestId, // ✅ Request tracking
        },
        body: JSON.stringify({
          text: text.trim(),
          voice: this.config.voice,
          model: model,
          speed: this.config.speed,
        }),
      });

      if (!response.ok) {
        let errorDetails: any;
        try {
          errorDetails = await response.json();
        } catch {
          errorDetails = { error: response.statusText };
        }
        
        // ✅ Fallback to standard model on timeout
        if (model === 'tts-1-hd' && (response.status === 504 || errorDetails.error?.includes('timeout'))) {
          logger.warn(`[TTSService] HD model timeout, falling back to standard model`);
          model = 'tts-1';
          
          // Retry with standard model
          const fallbackResponse = await fetch(`${supabaseUrl}/functions/v1/tts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
              'X-Request-ID': requestId,
            },
            body: JSON.stringify({
              text: text.trim(),
              voice: this.config.voice,
              model: 'tts-1',
              speed: this.config.speed,
            }),
          });
          
          if (!fallbackResponse.ok) {
            const fallbackError = await fallbackResponse.json().catch(() => ({}));
            throw new Error(`TTS failed: ${fallbackError.details || fallbackError.error || fallbackResponse.statusText}`);
          }
          
          const fallbackResult = await fallbackResponse.json();
          const audioDataUrl = `data:audio/mp3;base64,${fallbackResult.base64Audio}`;
          callbacks?.onSynthesized?.(audioDataUrl);
          return audioDataUrl;
        }
        
        // ✅ Enhanced error with details from server
        const errorMessage = errorDetails.details || errorDetails.error || response.statusText;
        throw new Error(`TTS failed: ${errorMessage}`);
      }

      const result = await response.json();
      const audioDataUrl = `data:audio/mp3;base64,${result.base64Audio}`;

      callbacks?.onSynthesized?.(audioDataUrl);
      return audioDataUrl;
    } catch (error) {
      // Use retry service for failures
      if (isFeatureEnabled('USE_RETRY_SERVICE')) {
        return this.retryService.withBackoff(
          () => this.synthesize(text, callbacks),
          'Text-to-Speech',
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
}

