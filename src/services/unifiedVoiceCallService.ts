/**
 * Unified Voice Call Service
 * Bridges V1 (REST) and V2 (WebSocket) implementations
 * Automatically selects best implementation based on feature flags
 */

import { supabase } from '@/lib/supabaseClient';
import { isFeatureEnabled } from '@/config/featureFlags';
import { logger } from '@/lib/logger';
import { voiceCallService } from './voiceCallService';
import { voiceCallServiceSimplified } from './voiceCallServiceSimplified';
import { VoiceCallServiceV2 } from './voiceV2/voiceCallServiceV2';
import { audioQueueService } from './audioQueueService';
import type { VoiceCallOptions as V1Options } from './voiceCallService';

// Unified options interface (compatible with both V1 and V2)
export interface UnifiedVoiceCallOptions {
  userId: string;
  conversationId: string;
  tier: 'studio';
  onTranscript: (text: string) => void;
  onAIResponse: (text: string) => void;
  onError: (error: Error) => void;
  onStatusChange?: (status: 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'reconnecting') => void;
  onAudioLevel?: (level: number) => void;
}

class UnifiedVoiceCallService {
  private v2Service: VoiceCallServiceV2 | null = null;
  private isV2Active = false;
  private v2AudioChunkIndex = 0; // Track audio chunk order for V2

  /**
   * Start voice call using V2 (WebSocket) or V1 (REST) based on feature flag
   */
  async startCall(options: UnifiedVoiceCallOptions): Promise<void> {
    // Check if V2 is enabled
    if (isFeatureEnabled('VOICE_V2')) {
      logger.info('[UnifiedVoice] 🚀 Using V2 (WebSocket streaming)');
      return this.startCallV2(options);
    } else {
      logger.info('[UnifiedVoice] 🚀 Using V1 (REST-based)');
      return this.startCallV1(options);
    }
  }

  /**
   * Start call with V1 (REST-based)
   */
  private async startCallV1(options: UnifiedVoiceCallOptions): Promise<void> {
    const v1Options: V1Options = {
      userId: options.userId,
      conversationId: options.conversationId,
      tier: options.tier,
      onTranscript: options.onTranscript,
      onAIResponse: options.onAIResponse,
      onError: options.onError,
      onStatusChange: options.onStatusChange,
      onAudioLevel: options.onAudioLevel,
    };

    this.isV2Active = false;
    
    // Use simplified version if flag is enabled
    if (isFeatureEnabled('VOICE_SIMPLIFIED')) {
      logger.info('[UnifiedVoice] 🌟 Using simplified V1 implementation');
      await voiceCallServiceSimplified.startCall(v1Options);
    } else {
      await voiceCallService.startCall(v1Options);
    }
  }

  /**
   * Start call with V2 (WebSocket streaming)
   */
  private async startCallV2(options: UnifiedVoiceCallOptions): Promise<void> {
    try {
      // Get auth token from Supabase session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      // Initialize V2 service if needed
      if (!this.v2Service) {
        this.v2Service = new VoiceCallServiceV2();
      }

      // Convert unified options to V2 options
      const v2Options = {
        userId: options.userId,
        conversationId: options.conversationId,
        authToken: session.access_token,
        onConnected: () => {
          logger.info('[UnifiedVoice] ✅ V2 connected');
          options.onStatusChange?.('listening');
        },
        onDisconnected: () => {
          logger.warn('[UnifiedVoice] ⚠️ V2 disconnected');
          options.onStatusChange?.('reconnecting');
        },
        onPartialTranscript: (text: string, confidence: number) => {
          // V2 sends partial transcripts - show in UI as user types
          logger.debug(`[UnifiedVoice] Partial transcript: ${text} (${(confidence * 100).toFixed(1)}%)`);
          // Don't update transcript yet - wait for final
        },
        onFinalTranscript: (text: string, confidence: number) => {
          logger.info(`[UnifiedVoice] Final transcript: ${text} (${(confidence * 100).toFixed(1)}%)`);
          options.onTranscript(text);
          options.onStatusChange?.('thinking');
        },
        onAudioChunk: (audioBase64: string, sentenceIndex?: number) => {
          // V2 sends audio chunks - queue them for sequential playback
          const index = sentenceIndex ?? this.v2AudioChunkIndex++;
          this.queueAudioChunk(audioBase64, index);
          options.onStatusChange?.('speaking');
        },
        onStatusChange: (status: string) => {
          // Map V2 statuses to unified statuses
          const unifiedStatus = this.mapV2StatusToUnified(status);
          options.onStatusChange?.(unifiedStatus);
        },
        onError: (error: Error) => {
          logger.error('[UnifiedVoice] V2 error:', error);
          options.onError(error);
        },
      };

      await this.v2Service.startCall(v2Options);
      this.isV2Active = true;
    } catch (error) {
      logger.error('[UnifiedVoice] V2 start failed, falling back to V1:', error);
      // ✅ CRITICAL FIX: Clean up V2 state before falling back to V1
      // Prevents "Call already in progress" error
      if (this.v2Service) {
        try {
          await this.v2Service.endCall();
        } catch (cleanupError) {
          logger.debug('[UnifiedVoice] V2 cleanup error (non-critical):', cleanupError);
        }
      }
      this.isV2Active = false;
      this.v2AudioChunkIndex = 0;
      
      // Fallback to V1 if V2 fails
      await this.startCallV1(options);
    }
  }

  /**
   * Map V2 status strings to unified status format
   */
  private mapV2StatusToUnified(status: string): 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'reconnecting' {
    switch (status) {
      case 'listening':
        return 'listening';
      case 'transcribing':
        return 'transcribing';
      case 'thinking':
      case 'ai_thinking':
        return 'thinking';
      case 'speaking':
        return 'speaking';
      case 'reconnecting':
      case 'disconnected':
        return 'reconnecting';
      default:
        return 'listening';
    }
  }

  /**
   * Queue audio chunk from V2 for sequential playback
   */
  private queueAudioChunk(audioBase64: string, index: number): void {
    try {
      // Convert base64 to blob URL for AudioQueueService
      const audioBlob = this.base64ToBlob(audioBase64, 'audio/mp3');
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      // Use audioQueueService to manage playback queue
      // V2 sends pre-generated audio, so we just need to queue it
      audioQueueService.addAudioDirectly(audio, index);
    } catch (error) {
      logger.error('[UnifiedVoice] Error queuing audio chunk:', error);
    }
  }

  /**
   * Convert base64 string to Blob
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * Stop voice call
   */
  async stopCall(userId: string): Promise<void> {
    try {
      if (this.isV2Active && this.v2Service) {
        logger.info('[UnifiedVoice] Stopping V2 call');
        await this.v2Service.endCall();
        this.isV2Active = false;
        this.v2AudioChunkIndex = 0; // Reset audio chunk counter
        audioQueueService.reset(); // Clear audio queue
      } else {
        logger.info('[UnifiedVoice] Stopping V1 call');
        if (isFeatureEnabled('VOICE_SIMPLIFIED')) {
          await voiceCallServiceSimplified.stopCall(userId);
        } else {
          await voiceCallService.stopCall(userId);
        }
      }
    } catch (error) {
      logger.error('[UnifiedVoice] Error stopping call:', error);
      // ✅ CRITICAL FIX: Ensure state is reset even if stop fails
      this.isV2Active = false;
      this.v2AudioChunkIndex = 0;
      audioQueueService.reset();
      throw error;
    }
  }

  /**
   * Get network quality (V1 only - V2 handles this internally)
   */
  getNetworkQuality(): 'excellent' | 'good' | 'poor' | 'offline' {
    if (this.isV2Active) {
      // V2 handles network quality internally via WebSocket
      return 'excellent'; // Assume good for V2 (WebSocket is more reliable)
    }
    if (isFeatureEnabled('VOICE_SIMPLIFIED')) {
      // Simplified version doesn't have network monitoring
      return 'excellent'; // Always assume good connection
    }
    return voiceCallService.getNetworkQuality();
  }

  /**
   * Toggle mute (V1 only - V2 handles this via WebSocket messages)
   * @param desiredState Optional desired mute state. If not provided, toggles current state.
   */
  async toggleMute(desiredState?: boolean): Promise<boolean> {
    if (this.isV2Active && this.v2Service) {
      // V2 mute is handled via WebSocket control messages
      // This would need to be implemented in VoiceCallServiceV2
      logger.warn('[UnifiedVoice] V2 mute not yet implemented');
      return false;
    }
    return voiceCallService.toggleMute(desiredState);
  }

  /**
   * Check if call is active
   */
  isActive(): boolean {
    if (this.isV2Active && this.v2Service) {
      // V2 service tracks isActive internally
      return (this.v2Service as any).isActive ?? false;
    }
    return voiceCallService.isActive();
  }
}

// Export singleton instance
export const unifiedVoiceCallService = new UnifiedVoiceCallService();

