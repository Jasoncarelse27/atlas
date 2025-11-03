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

  // ✅ RECONNECTION: Track reconnection attempts
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private reconnectTimer: number | null = null;
  private lastOptions: VoiceCallOptions | null = null;
  
  // ✅ HEARTBEAT: Keep-alive ping/pong
  private heartbeatInterval: number | null = null;
  private lastPongTime: number = Date.now();
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly PONG_TIMEOUT = 10000; // 10 seconds

  /**
   * Get optimal buffer size based on device (mobile = lower latency, desktop = better quality)
   * Must be power of 2: 256, 512, 1024, 2048, 4096, 8192, 16384
   * 
   * ✅ BEST PRACTICE: Web Audio API requires power-of-2 buffer sizes
   * ✅ CRITICAL: Never use 1600 (not a power of 2) - causes IndexSizeError
   * ✅ Industry Standard: 1024-2048 for real-time audio (64-128ms latency)
   */
  private getOptimalBufferSize(): number {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    // ✅ CRITICAL: Must be power of 2 - 1600 will cause IndexSizeError
    // Mobile: 1024 (64ms) for lower latency, Desktop: 2048 (128ms) for better quality
    const bufferSize = isMobile ? 1024 : 2048;
    
    // ✅ SAFETY CHECK: Ensure power of 2 (defensive programming)
    if ((bufferSize & (bufferSize - 1)) !== 0) {
      logger.error(`[VoiceV2] ❌ Invalid buffer size: ${bufferSize} (not power of 2)`);
      return 1024; // Fallback to safe default
    }
    
    return bufferSize;
  }
  
  // Audio configuration (chunkSize computed dynamically for device optimization)
  private get audioConfig(): AudioConfig {
    return {
      sampleRate: 16000,
      channelCount: 1,
      encoding: 'linear16',
      chunkSize: this.getOptimalBufferSize(), // ✅ FIXED v1.1: Adaptive buffer size (power of 2 required)
    };
  }

  /**
   * Start voice call
   */
  async startCall(options: VoiceCallOptions): Promise<void> {
    try {
      logger.info('[VoiceV2] 🚀 Starting voice call...');

      // ✅ RECONNECTION: Save options for reconnection
      this.lastOptions = options;

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

      // ✅ HEARTBEAT: Start keep-alive pings
      this.startHeartbeat();

      this.isActive = true;
      logger.info('[VoiceV2] ✅ Voice call started');
    } catch (error) {
      logger.error('[VoiceV2] ❌ Failed to start call:', error);
      
      // ✅ CRITICAL FIX: Clean up resources if start fails
      // Prevents recording icon from staying on
      try {
        this.stopAudioCapture();
      } catch (cleanupError) {
        logger.warn('[VoiceV2] Error during cleanup after failed start:', cleanupError);
      }
      
      // Close WebSocket if it was opened
      if (this.ws) {
        try {
          this.ws.close();
          this.ws = null;
        } catch (wsError) {
          logger.warn('[VoiceV2] Error closing WebSocket after failed start:', wsError);
        }
      }
      
      this.isActive = false;
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

    // ✅ RECONNECTION: Clear reconnection attempts
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // ✅ HEARTBEAT: Stop keep-alive
    this.stopHeartbeat();

    // Stop audio capture
    this.stopAudioCapture();

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.sessionId = null;
    this.lastOptions = null;
    logger.info('[VoiceV2] ✅ Voice call ended');
  }

  /**
   * Connect to WebSocket server
   */
  private async connectWebSocket(options: VoiceCallOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Determine WebSocket URL
        // ✅ Multi-region support: Fly.io automatically routes to nearest region
        const getWebSocketUrl = (): string => {
          // Use explicit URL if configured
          const explicitUrl = import.meta.env.VITE_VOICE_V2_URL;
          if (explicitUrl) return explicitUrl;

          // Production: Use Fly.io domain (routed automatically by Anycast)
          if (window.location.hostname.includes('vercel.app') || 
              window.location.hostname.includes('atlas')) {
            return 'wss://atlas-voice-v2.fly.dev';
          }

          // Development: Use local proxy
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const host = window.location.host;
          return `${protocol}//${host}/api/voice-v2`;
        };

        const wsUrl = getWebSocketUrl();

        logger.info(`[VoiceV2] 🔌 Connecting to ${wsUrl}...`);

        this.ws = new WebSocket(wsUrl);

        // Connection opened
        this.ws.onopen = () => {
          logger.info('[VoiceV2] ✅ WebSocket connected');
          // ✅ RECONNECTION: Reset attempts on successful connection
          this.reconnectAttempts = 0;
          resolve();
        };

        // Message received
        this.ws.onmessage = (event) => {
          this.handleServerMessage(event.data, options);
        };

        // Connection closed
        this.ws.onclose = (event) => {
          logger.info(`[VoiceV2] 🔴 WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
          
          // ✅ RECONNECTION: Attempt to reconnect if not intentionally closed
          if (this.isActive && event.code !== 1000) {
            logger.warn('[VoiceV2] ⚠️  Unexpected disconnection, attempting reconnect...');
            this.attemptReconnect(options);
          } else {
            options.onDisconnected();
          }
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
          logger.debug(`[VoiceV2] 🔊 Audio chunk received (index: ${message.sentenceIndex})`);
          // Pass sentenceIndex to callback for proper ordering
          options.onAudioChunk(message.audio, message.sentenceIndex);
          break;

        case 'status':
          logger.debug(`[VoiceV2] 📊 Status: ${message.status}`);
          options.onStatusChange(message.status);
          break;

        case 'error': {
          logger.error(`[VoiceV2] ❌ Error: ${message.message}`);
          
          // ✅ SECURITY: Handle authentication errors specially
          const errorCode = (message as any).code;
          if (errorCode === 'AUTH_REQUIRED' || errorCode === 'AUTH_INVALID' || errorCode === 'AUTH_ERROR') {
            const authError = new Error(`Authentication failed: ${message.message}`);
            (authError as any).code = errorCode;
            options.onError(authError);
            
            // Close connection on auth failure
            this.endCall();
          } else {
            options.onError(new Error(message.message));
          }
          break;
        }

        case 'pong':
          logger.debug('[VoiceV2] 🏓 Pong received');
          // ✅ HEARTBEAT: Update last pong time
          this.lastPongTime = Date.now();
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
          autoGainControl: false, // ✅ FIX: Disable to prevent Mac input volume resetting
        },
      });

      // Create audio context
      this.audioContext = new AudioContext({ 
        sampleRate: this.audioConfig.sampleRate 
      });

      const source = this.audioContext.createMediaStreamSource(this.stream);

      // Create processor to capture audio chunks
      // ✅ CRITICAL FIX: Use optimal buffer size (power of 2, device-aware)
      const bufferSize = this.getOptimalBufferSize();
      logger.debug(`[VoiceV2] Using bufferSize=${bufferSize} (device: ${navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop'})`);
      this.processor = this.audioContext.createScriptProcessor(
        bufferSize,
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
    // ✅ CRITICAL FIX: Safe cleanup with error handling
    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch (error) {
        logger.warn('[VoiceV2] Error disconnecting processor:', error);
      }
      this.processor = null;
    }

    if (this.stream) {
      try {
        this.stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (error) {
            logger.warn('[VoiceV2] Error stopping track:', error);
          }
        });
      } catch (error) {
        logger.warn('[VoiceV2] Error accessing stream tracks:', error);
      }
      this.stream = null;
    }

    if (this.audioContext) {
      try {
        // ✅ CRITICAL FIX: Check state before closing (prevents "InvalidStateError")
        if (this.audioContext.state !== 'closed') {
          this.audioContext.close().catch(error => {
            logger.warn('[VoiceV2] Error closing AudioContext:', error);
          });
        }
      } catch (error) {
        logger.warn('[VoiceV2] Error closing AudioContext:', error);
      }
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

  /**
   * ✅ RECONNECTION: Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(options: VoiceCallOptions): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error('[VoiceV2] ❌ Max reconnection attempts reached');
      options.onError(new Error('Max reconnection attempts reached'));
      this.endCall();
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 30s)
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    logger.info(`[VoiceV2] 🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);

    this.reconnectTimer = window.setTimeout(async () => {
      if (!this.isActive || !this.lastOptions) {
        return;
      }

      try {
        // Close existing connection
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }

        // Reconnect
        await this.connectWebSocket(this.lastOptions);

        // Resend session start
        this.sendControlMessage({
          type: 'session_start',
          userId: this.lastOptions.userId,
          conversationId: this.lastOptions.conversationId,
          authToken: this.lastOptions.authToken,
        });

        // Resume audio capture if needed
        if (!this.stream) {
          await this.startAudioCapture(this.lastOptions);
        }

        logger.info('[VoiceV2] ✅ Reconnected successfully');
      } catch (error) {
        logger.error('[VoiceV2] ❌ Reconnection failed:', error);
        this.attemptReconnect(this.lastOptions);
      }
    }, delay);
  }

  /**
   * ✅ HEARTBEAT: Start sending keep-alive pings
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Clear any existing interval

    this.lastPongTime = Date.now();

    this.heartbeatInterval = window.setInterval(() => {
      // Check if pong was received recently
      const timeSinceLastPong = Date.now() - this.lastPongTime;
      if (timeSinceLastPong > this.HEARTBEAT_INTERVAL + this.PONG_TIMEOUT) {
        logger.warn('[VoiceV2] ⚠️  Heartbeat timeout - connection may be dead');
        if (this.lastOptions) {
          this.attemptReconnect(this.lastOptions);
        }
        return;
      }

      // Send ping
      this.ping();
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * ✅ HEARTBEAT: Stop keep-alive pings
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

// Export singleton instance
export const voiceCallServiceV2 = new VoiceCallServiceV2();

