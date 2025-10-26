// Voice V2 - Client-Side WebSocket Service
import { logger } from '@/lib/logger';
import type {
    AudioConfig,
    ClientMessage,
    ServerMessage,
    VoiceCallOptions,
} from './types';

/**
 * 🎙️ Voice Call Service V2
 * 
 * WebSocket-based real-time voice conversation with streaming STT/LLM/TTS.
 * 
 * Architecture:
 * - Client captures audio (16kHz PCM) → sends via WebSocket
 * - Server streams back: partial transcripts, final transcripts, audio chunks
 * - Total target latency: < 2 seconds
 */
export class VoiceCallServiceV2 {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private sessionId: string | null = null;
  private isActive: boolean = false;

  // Audio configuration
  private readonly audioConfig: AudioConfig = {
    sampleRate: 16000,
    channelCount: 1,
    encoding: 'linear16',
    chunkSize: 4096, // 256ms at 16kHz
  };

  /**
   * Start voice call
   */
  async startCall(options: VoiceCallOptions): Promise<void> {
    try {
      logger.info('[VoiceV2] 🚀 Starting voice call...');

      // 1. Connect WebSocket
      await this.connectWebSocket(options);

      // 2. Start audio capture
      await this.startAudioCapture(options);

      // 3. Send session start message
      this.sendControlMessage({
        type: 'session_start',
        userId: options.userId,
        conversationId: options.conversationId,
        authToken: options.authToken,
      });

      this.isActive = true;
      logger.info('[VoiceV2] ✅ Voice call started');
    } catch (error) {
      logger.error('[VoiceV2] ❌ Failed to start call:', error);
      options.onError(error as Error);
      throw error;
    }
  }

  /**
   * End voice call
   */
  async endCall(): Promise<void> {
    logger.info('[VoiceV2] 🔴 Ending voice call...');

    this.isActive = false;

    // Stop audio capture
    this.stopAudioCapture();

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.sessionId = null;
    logger.info('[VoiceV2] ✅ Voice call ended');
  }

  /**
   * Connect to WebSocket server
   */
  private async connectWebSocket(options: VoiceCallOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Determine WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/voice-v2`;

        logger.info(`[VoiceV2] 🔌 Connecting to ${wsUrl}...`);

        this.ws = new WebSocket(wsUrl);

        // Connection opened
        this.ws.onopen = () => {
          logger.info('[VoiceV2] ✅ WebSocket connected');
          resolve();
        };

        // Message received
        this.ws.onmessage = (event) => {
          this.handleServerMessage(event.data, options);
        };

        // Connection closed
        this.ws.onclose = () => {
          logger.info('[VoiceV2] 🔴 WebSocket closed');
          options.onDisconnected();
        };

        // Error occurred
        this.ws.onerror = (error) => {
          logger.error('[VoiceV2] ❌ WebSocket error:', error);
          reject(new Error('WebSocket connection failed'));
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle messages from server
   */
  private handleServerMessage(data: string, options: VoiceCallOptions): void {
    try {
      const message: ServerMessage = JSON.parse(data);

      logger.debug(`[VoiceV2] 📨 Received: ${message.type}`);

      switch (message.type) {
        case 'connected':
          this.sessionId = message.sessionId;
          logger.info(`[VoiceV2] ✅ Session ID: ${this.sessionId}`);
          options.onConnected();
          break;

        case 'session_started':
          logger.info('[VoiceV2] ✅ Session started');
          break;

        case 'audio_received':
          logger.debug(`[VoiceV2] ✅ Audio received (${message.size} bytes)`);
          break;

        case 'partial_transcript':
          logger.debug(`[VoiceV2] 📝 Partial: ${message.text}`);
          options.onPartialTranscript(message.text, message.confidence);
          break;

        case 'final_transcript':
          logger.info(`[VoiceV2] ✅ Final: ${message.text}`);
          options.onFinalTranscript(message.text, message.confidence);
          break;

        case 'audio_chunk':
          logger.debug('[VoiceV2] 🔊 Audio chunk received');
          options.onAudioChunk(message.audio);
          break;

        case 'status':
          logger.debug(`[VoiceV2] 📊 Status: ${message.status}`);
          options.onStatusChange(message.status);
          break;

        case 'error':
          logger.error(`[VoiceV2] ❌ Error: ${message.message}`);
          options.onError(new Error(message.message));
          break;

        case 'pong':
          logger.debug('[VoiceV2] 🏓 Pong received');
          break;

        default:
          logger.warn(`[VoiceV2] ⚠️ Unknown message type:`, message);
      }
    } catch (error) {
      logger.error('[VoiceV2] ❌ Failed to parse message:', error);
    }
  }

  /**
   * Start capturing audio from microphone
   */
  private async startAudioCapture(_options: VoiceCallOptions): Promise<void> {
    try {
      logger.info('[VoiceV2] 🎤 Starting audio capture...');

      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.audioConfig.sampleRate,
          channelCount: this.audioConfig.channelCount,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create audio context
      this.audioContext = new AudioContext({ 
        sampleRate: this.audioConfig.sampleRate 
      });

      const source = this.audioContext.createMediaStreamSource(this.stream);

      // Create processor to capture audio chunks
      this.processor = this.audioContext.createScriptProcessor(
        this.audioConfig.chunkSize,
        this.audioConfig.channelCount,
        this.audioConfig.channelCount
      );

      this.processor.onaudioprocess = (e) => {
        if (!this.isActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return;
        }

        // Get audio data (Float32Array)
        const audioData = e.inputBuffer.getChannelData(0);

        // Convert Float32 (-1 to 1) to Int16 (-32768 to 32767)
        const pcm = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          const s = Math.max(-1, Math.min(1, audioData[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send as binary data
        this.ws.send(pcm.buffer);
      };

      // Connect audio pipeline
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      logger.info('[VoiceV2] ✅ Audio capture started');
    } catch (error) {
      logger.error('[VoiceV2] ❌ Failed to start audio capture:', error);
      throw error;
    }
  }

  /**
   * Stop audio capture
   */
  private stopAudioCapture(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    logger.info('[VoiceV2] ✅ Audio capture stopped');
  }

  /**
   * Send control message to server
   */
  private sendControlMessage(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      logger.debug(`[VoiceV2] 📤 Sent: ${message.type}`);
    } else {
      logger.warn('[VoiceV2] ⚠️ Cannot send message - WebSocket not open');
    }
  }

  /**
   * Send ping to keep connection alive
   */
  ping(): void {
    this.sendControlMessage({ type: 'ping' });
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }
}

// Export singleton instance
export const voiceCallServiceV2 = new VoiceCallServiceV2();

