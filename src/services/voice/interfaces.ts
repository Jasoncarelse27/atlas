/**
 * Voice Service Interfaces
 * 
 * TypeScript interfaces for all voice call services extracted from voiceCallService.ts
 * These interfaces define the contracts for safe service extraction.
 * 
 * Created: 2025-01-01
 * Purpose: Define service boundaries before extraction
 */

import type { VoiceCallOptions } from './voiceCallService';

// ============================================================================
// 1. Voice Activity Detection (VAD) Service
// ============================================================================

export interface VADServiceConfig {
  silenceDuration: number; // Default: 250ms
  minSpeechDuration: number; // Default: 300ms
  minRecordingDuration: number; // Default: 150ms
  resumeCheckInterval: number; // Default: 300ms
  minProcessInterval: number; // Default: 500ms - ChatGPT-like responsiveness
}

export interface VADServiceCallbacks {
  onAudioLevel?: (level: number) => void; // 0-1 for VAD feedback
  onSpeechDetected?: () => void;
  onSilenceDetected?: () => void;
}

export interface VADService {
  /**
   * Start recording with VAD
   * Sets up audio context, analyser, and MediaRecorder
   */
  startRecording(options: {
    onAudioLevel?: (level: number) => void;
    onRecordingStopped: (audioBlob: Blob) => Promise<void>;
  }): Promise<void>;

  /**
   * Calibrate ambient noise level
   * Should be called before starting VAD monitoring
   */
  calibrate(): Promise<void>;

  /**
   * Start VAD monitoring
   * Begins checking audio levels for speech/silence detection
   */
  startMonitoring(callbacks: VADServiceCallbacks): void;

  /**
   * Restart recording for next chunk
   * Should be called after processing audio chunk
   */
  restart(): void;

  /**
   * Stop VAD and cleanup resources
   */
  stop(): Promise<void>;

  /**
   * Check if recording is active
   */
  isRecording(): boolean;

  /**
   * Get current audio level (0-1)
   */
  getAudioLevel(): number;
}

// ============================================================================
// 2. Network Quality Monitoring Service
// ============================================================================

export type NetworkQuality = 'excellent' | 'good' | 'poor' | 'offline';

export interface NetworkMonitoringServiceConfig {
  checkInterval: number; // Default: 5000ms
  maxLatencyHistory: number; // Default: 10
  healthCheckEndpoint: string; // Default: '/api/health'
  healthCheckTimeout: number; // Default: 2000ms
}

export interface NetworkMonitoringServiceCallbacks {
  onQualityChange?: (quality: NetworkQuality, previousQuality: NetworkQuality) => void;
}

export interface NetworkMonitoringService {
  /**
   * Start network quality monitoring
   */
  start(callbacks?: NetworkMonitoringServiceCallbacks): void;

  /**
   * Stop network quality monitoring
   */
  stop(): void;

  /**
   * Check current network quality
   */
  checkQuality(): Promise<NetworkQuality>;

  /**
   * Get current network quality (cached)
   */
  getQuality(): NetworkQuality;

  /**
   * Get adaptive timeout based on network quality
   */
  getSTTTimeout(): number;

  /**
   * Get recent API latencies
   */
  getRecentLatencies(): number[];
}

// ============================================================================
// 3. STT (Speech-to-Text) Service
// ============================================================================

export interface STTServiceConfig {
  endpoint: string; // Default: '/api/stt-deepgram'
  timeout: number; // Adaptive based on network quality
  minConfidence: number; // Default: 0.2 (20%)
  minTranscriptLength: number; // Default: 2 characters
}

export interface STTTranscriptionResult {
  text: string;
  confidence: number;
  latency: number;
}

export interface STTServiceCallbacks {
  onTranscribed?: (text: string, confidence: number) => void;
  onRetry?: (attempt: number, maxRetries: number) => void;
  onError?: (error: Error) => void;
}

export interface ISTTService {
  /**
   * Transcribe audio blob to text
   */
  transcribe(
    audioBlob: Blob,
    callbacks?: STTServiceCallbacks
  ): Promise<string>;
}

// Legacy alias for backward compatibility
export type STTService = ISTTService;

// ============================================================================
// 4. TTS (Text-to-Speech) Service
// ============================================================================

export interface TTSServiceConfig {
  endpoint: string; // Default: '/functions/v1/tts' or streaming
  voice: string; // Default: 'nova'
  model: string; // Default: 'tts-1-hd'
  speed: number; // Default: 1.05
}

export interface TTSServiceCallbacks {
  onSynthesized?: (audioDataUrl: string) => void;
  onRetry?: (attempt: number, maxRetries: number) => void;
  onError?: (error: Error) => void;
}

export interface ITTSService {
  /**
   * Synthesize speech from text
   */
  synthesize(
    text: string,
    callbacks?: TTSServiceCallbacks
  ): Promise<string>; // Returns base64 audio data URL
}

// Legacy alias for backward compatibility
export type TTSService = ITTSService;

// ============================================================================
// 5. Audio Playback Service
// ============================================================================

export interface AudioPlaybackServiceCallbacks {
  onPlay?: () => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
}

export interface AudioPlaybackService {
  /**
   * Play audio from base64 data URL
   */
  play(
    audioDataUrl: string,
    callbacks?: AudioPlaybackServiceCallbacks
  ): Promise<void>;

  /**
   * Stop current audio playback
   */
  stop(): void;

  /**
   * Check if audio is currently playing
   */
  isPlaying(): boolean;

  /**
   * Get current audio element (for external control)
   */
  getCurrentAudio(): HTMLAudioElement | null;
}

// ============================================================================
// 6. Message Persistence Service
// ============================================================================

export interface MessagePersistenceService {
  /**
   * Save voice message to database
   */
  saveMessage(
    text: string,
    role: 'user' | 'assistant',
    conversationId: string,
    userId: string
  ): Promise<void>;

  /**
   * Track call metering/usage
   */
  trackCallMetering(
    userId: string,
    durationSeconds: number,
    tier: string
  ): Promise<void>;
}

// ============================================================================
// 7. Call Lifecycle Management Service
// ============================================================================

export interface CallLifecycleServiceConfig {
  maxCallDuration: number; // Default: 30 minutes
  durationCheckInterval: number; // Default: 30000ms
}

export interface CallLifecycleServiceCallbacks {
  onCallStarted?: () => void;
  onCallStopped?: (durationSeconds: number) => void;
  onMaxDurationReached?: () => void;
}

export interface ICallLifecycleService {
  /**
   * Start call lifecycle management
   */
  start(callbacks: CallLifecycleServiceCallbacks): void;

  /**
   * Stop call and cleanup all resources
   */
  stop(): void;

  /**
   * Check if call is active
   */
  isCallActive(): boolean;

  /**
   * Get call duration in seconds
   */
  getCallDuration(): number;
}

// Legacy alias
export type CallLifecycleService = ICallLifecycleService;

// ============================================================================
// 8. Retry Logic Service
// ============================================================================

export interface RetryServiceConfig {
  maxRetries: number; // Default: 5
  retryDelays: number[]; // Default: [1000, 2000, 4000, 8000, 10000]
  jitterPercent: number; // Default: 0.3 (30%)
}

export interface RetryServiceCallbacks {
  onRetry?: (attempt: number, maxRetries: number) => void;
  onError?: (error: Error, attempt: number) => void;
}

export interface RetryService {
  /**
   * Execute function with exponential backoff retry
   */
  withBackoff<T>(
    fn: () => Promise<T>,
    operation: string,
    callbacks?: RetryServiceCallbacks
  ): Promise<T>;
}

// ============================================================================
// 9. Timeout Management Service
// ============================================================================

export interface ITimeoutManagementService {
  /**
   * Set timeout and track it for cleanup
   */
  setTimeout(callback: () => void, delay: number): NodeJS.Timeout;

  /**
   * Set interval and track it for cleanup
   */
  setInterval(callback: () => void, delay: number): NodeJS.Timeout;

  /**
   * Clear timeout and remove from tracking
   */
  clearTimeout(timeout: NodeJS.Timeout): void;

  /**
   * Clear interval and remove from tracking
   */
  clearInterval(interval: NodeJS.Timeout): void;

  /**
   * Clear all tracked timeouts and intervals
   */
  clearAll(): void;

  /**
   * Get count of pending timeouts
   */
  getPendingTimeoutCount(): number;

  /**
   * Get count of pending intervals
   */
  getPendingIntervalCount(): number;

  /**
   * Get the underlying Set (for direct access if needed)
   */
  getPendingTimeouts(): Set<NodeJS.Timeout>;
}

// Legacy alias
export type TimeoutService = ITimeoutManagementService;

// ============================================================================
// Unified Service Interface (for composition)
// ============================================================================

export interface VoiceCallServiceComposition {
  vad: VADService;
  network: NetworkMonitoringService;
  stt: STTService;
  tts: TTSService;
  playback: AudioPlaybackService;
  persistence: MessagePersistenceService;
  lifecycle: CallLifecycleService;
  retry: RetryService;
  timeout: TimeoutService;
}

