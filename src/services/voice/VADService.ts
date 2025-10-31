/**
 * Voice Activity Detection (VAD) Service
 * 
 * ChatGPT-style voice activity detection with adaptive threshold calibration.
 * Extracted from voiceCallService.ts for better separation of concerns.
 * 
 * Created: 2025-01-01
 */

import { getSafeUserMedia } from '@/utils/audioHelpers';
import { logger } from '@/lib/logger';
import { isFeatureEnabled } from '@/config/featureFlags';
import { audioQueueService } from '../audioQueueService';
import type {
  VADServiceConfig,
  VADServiceCallbacks,
  VADService as IVADService,
} from './interfaces';

export class VADService implements IVADService {
  // Audio context and nodes
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private vadCheckInterval: NodeJS.Timeout | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;

  // Speech detection state
  private silenceStartTime: number | null = null;
  private lastSpeechTime: number | null = null;
  private recordingStartTime: number = 0;

  // Threshold calibration
  private baselineNoiseLevel: number = 0;
  private adaptiveThreshold: number = 0.02;
  private isCalibrated: boolean = false;

  // Configuration
  private config: VADServiceConfig;
  private callbacks?: VADServiceCallbacks;
  private currentAudioLevel: number = 0;

  // Shared state callbacks (for sync with VoiceCallService)
  private onIsProcessingCheck?: () => boolean;
  private onIsActiveCheck?: () => boolean;
  private onHasInterruptedCheck?: () => boolean;
  private onInterruptTimeGet?: () => number | null;
  private onSetHasInterrupted?: (value: boolean) => void;
  private onSetInterruptTime?: (value: number | null) => void;
  private onSetResumeAttempted?: (value: boolean) => void;
  private onGetResumeAttempted?: () => boolean;
  private onSetLastResumeCheckTime?: (value: number) => void;
  private onGetLastResumeCheckTime?: () => number;
  private onSetLastProcessTime?: (value: number) => void;
  private onGetLastProcessTime?: () => number;
  private onSetLastRejectedTime?: (value: number) => void;
  private onGetLastRejectedTime?: () => number;
  private onSetIsProcessing?: (value: boolean) => void;
  private onGetIsAtlasSpeaking?: () => boolean;
  private onStatusChange?: (status: 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'reconnecting') => void;
  private recordingMimeType: string = 'audio/webm';

  constructor(config: Partial<VADServiceConfig> = {}) {
    this.config = {
      silenceDuration: config.silenceDuration ?? 250,
      minSpeechDuration: config.minSpeechDuration ?? 300,
      minRecordingDuration: config.minRecordingDuration ?? 150,
      resumeCheckInterval: config.resumeCheckInterval ?? 300,
    };
  }

  /**
   * Set shared state callbacks for synchronization with VoiceCallService
   */
  setSharedStateCallbacks(callbacks: {
    onIsProcessingCheck?: () => boolean;
    onIsActiveCheck?: () => boolean;
    onHasInterruptedCheck?: () => boolean;
    onInterruptTimeGet?: () => number | null;
    onSetHasInterrupted?: (value: boolean) => void;
    onSetInterruptTime?: (value: number | null) => void;
    onSetResumeAttempted?: (value: boolean) => void;
    onGetResumeAttempted?: () => boolean;
    onSetLastResumeCheckTime?: (value: number) => void;
    onGetLastResumeCheckTime?: () => number;
    onSetLastProcessTime?: (value: number) => void;
    onGetLastProcessTime?: () => number;
    onSetLastRejectedTime?: (value: number) => void;
    onGetLastRejectedTime?: () => number;
    onSetIsProcessing?: (value: boolean) => void;
    onGetIsAtlasSpeaking?: () => boolean;
    onStatusChange?: (status: 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'reconnecting') => void;
    onRecordingStopped: (audioBlob: Blob, mimeType: string) => Promise<void>;
  }): void {
    this.onIsProcessingCheck = callbacks.onIsProcessingCheck;
    this.onIsActiveCheck = callbacks.onIsActiveCheck;
    this.onHasInterruptedCheck = callbacks.onHasInterruptedCheck;
    this.onInterruptTimeGet = callbacks.onInterruptTimeGet;
    this.onSetHasInterrupted = callbacks.onSetHasInterrupted;
    this.onSetInterruptTime = callbacks.onSetInterruptTime;
    this.onSetResumeAttempted = callbacks.onSetResumeAttempted;
    this.onGetResumeAttempted = callbacks.onGetResumeAttempted;
    this.onSetLastResumeCheckTime = callbacks.onSetLastResumeCheckTime;
    this.onGetLastResumeCheckTime = callbacks.onGetLastResumeCheckTime;
    this.onSetLastProcessTime = callbacks.onSetLastProcessTime;
    this.onGetLastProcessTime = callbacks.onGetLastProcessTime;
    this.onSetLastRejectedTime = callbacks.onSetLastRejectedTime;
    this.onGetLastRejectedTime = callbacks.onGetLastRejectedTime;
    this.onSetIsProcessing = callbacks.onSetIsProcessing;
    this.onGetIsAtlasSpeaking = callbacks.onGetIsAtlasSpeaking;
    this.onStatusChange = callbacks.onStatusChange;
    this.onRecordingStopped = callbacks.onRecordingStopped;
  }

  private onRecordingStopped?: (audioBlob: Blob, mimeType: string) => Promise<void>;

  /**
   * Start recording with VAD
   */
  async startRecording(options: {
    onAudioLevel?: (level: number) => void;
    onRecordingStopped: (audioBlob: Blob) => Promise<void>;
  }): Promise<void> {
    try {
      // Get microphone stream
      const stream = await getSafeUserMedia({ audio: true });
      this.stream = stream;

      // Setup Web Audio API for VAD
      this.audioContext = new AudioContext();

      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        logger.info('[VAD] 🔄 Resuming suspended audio context...');
        await this.audioContext.resume();
        logger.info(`[VAD] ✅ Audio context state: ${this.audioContext.state}`);
      }

      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.microphone.connect(this.analyser);

      // Check audio tracks and test if muted
      const audioTracks = stream.getAudioTracks();
      logger.info(`[VAD] 🎤 Audio tracks: ${audioTracks.length}`);
      
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        
        if (!track.enabled) {
          logger.warn('[VAD] ⚠️ Microphone track is disabled - enabling');
          track.enabled = true;
        }

        if (track.muted) {
          logger.warn('[VAD] ⚠️ Track reports muted, testing actual audio levels...');
          
          if (this.audioContext && this.audioContext.state !== 'running') {
            await this.audioContext.resume();
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          await new Promise(resolve => setTimeout(resolve, 200));

          let audioDetected = false;
          let maxRms = 0;

          for (let check = 0; check < 10; check++) {
            await new Promise(resolve => setTimeout(resolve, 100));

            if (!this.analyser || !this.audioContext || this.audioContext.state !== 'running') {
              continue;
            }

            const dataArray = new Uint8Array(this.analyser.fftSize);
            this.analyser.getByteTimeDomainData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const normalized = (dataArray[i] - 128) / 128;
              sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            maxRms = Math.max(maxRms, rms);

            if (rms > 0.005) {
              audioDetected = true;
              logger.info(`[VAD] ✅ Audio detected despite muted flag (RMS: ${rms.toFixed(4)})`);
              break;
            }
          }

          if (!audioDetected) {
            logger.error(`[VAD] ❌ No audio detected - max RMS: ${maxRms.toFixed(4)}`);
            throw new Error(
              'Microphone is muted at system level.\n\n' +
              'Quick Fix:\n' +
              '1. Press F10 (or Fn+F10) - hardware mute toggle\n' +
              '2. Check macOS Sound → Input\n' +
              '3. Check Control Center (top-right menu bar)\n\n' +
              'After fixing, refresh the page and try again.'
            );
          }
        }
      }

      // Calibrate ambient noise
      await this.calibrate();

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg;codecs=opus';

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      this.recordingMimeType = this.mediaRecorder.mimeType || mimeType;
      logger.info(`[VAD] 🎙️ VAD enabled with format: ${this.recordingMimeType}`);

      // Audio chunk collection
      let audioChunks: Blob[] = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (!this.onIsActiveCheck?.()) {
          logger.debug('[VAD] MediaRecorder stopped but call is inactive');
          audioChunks = [];
          return;
        }

        if (audioChunks.length === 0) {
          logger.debug('[VAD] No audio chunks collected - restarting recorder');
          this.restart();
          return;
        }

        const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);

        if (totalSize < 200) {
          logger.debug(`[VAD] 🤫 Too quiet (${totalSize} bytes) - waiting for louder speech...`);
          audioChunks = [];
          this.restart();
          return;
        }

        const audioBlob = new Blob(audioChunks, { type: this.recordingMimeType });
        audioChunks = [];

        logger.debug(`[VAD] 📦 Processing audio chunk: ${(audioBlob.size / 1024).toFixed(1)}KB`);

        if (this.onIsProcessingCheck?.()) {
          logger.debug('[VAD] ⚠️ Already processing - skipping duplicate chunk');
          audioChunks = [];
          return;
        }

        this.onSetIsProcessing?.(true);

        try {
          await options.onRecordingStopped(audioBlob);
          this.restart();
        } catch (error) {
          this.onSetIsProcessing?.(false);
          logger.error('[VAD] Error processing chunk:', error);
          this.restart();
        }
      };

      // Initialize state
      this.lastSpeechTime = null;
      this.silenceStartTime = null;
      this.onSetLastProcessTime?.(0);
      this.onSetLastRejectedTime?.(0);
      this.recordingStartTime = Date.now();

      // Start monitoring
      this.startMonitoring({ onAudioLevel: options.onAudioLevel });

      // Start recording
      this.mediaRecorder.start(100);
      logger.debug('[VAD] 🎙️ Recording started, waiting for speech...');

    } catch (error) {
      logger.error('[VAD] Recording setup failed:', error);
      throw error;
    }
  }

  /**
   * Calibrate ambient noise level
   */
  async calibrate(): Promise<void> {
    if (!this.analyser) {
      logger.error('[VAD] ❌ Cannot calibrate - analyser not initialized');
      return;
    }

    logger.info('[VAD] 🔧 Calibrating ambient noise level...');

    const samples: number[] = [];
    const dataArray = new Uint8Array(this.analyser.fftSize);

    for (let i = 0; i < 20; i++) {
      this.analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let j = 0; j < dataArray.length; j++) {
        const normalized = (dataArray[j] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      samples.push(rms);

      await new Promise(r => setTimeout(r, 100));
    }

    samples.sort((a, b) => a - b);
    this.baselineNoiseLevel = samples[Math.floor(samples.length / 2)];
    this.adaptiveThreshold = Math.max(this.baselineNoiseLevel * 1.8, 0.015);
    this.isCalibrated = true;

    logger.info(`[VAD] ✅ Calibrated - Baseline: ${(this.baselineNoiseLevel * 100).toFixed(1)}%, Threshold: ${(this.adaptiveThreshold * 100).toFixed(1)}%`);
  }

  /**
   * Start VAD monitoring
   */
  startMonitoring(callbacks: VADServiceCallbacks): void {
    if (!this.analyser) {
      logger.error('[VAD] ❌ Cannot start VAD - analyser not initialized');
      return;
    }

    this.callbacks = callbacks;
    const dataArray = new Uint8Array(this.analyser.fftSize);

    const checkVAD = () => {
      if (!this.onIsActiveCheck?.() || !this.analyser) return;

      const isAtlasSpeaking = this.onGetIsAtlasSpeaking?.() ?? false;

      if (isAtlasSpeaking && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        logger.debug('[VAD] 🛑 Stopping recording - Atlas is speaking');
        this.mediaRecorder.stop();
        return;
      }

      if (isAtlasSpeaking) {
        return;
      }

      try {
        this.analyser.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const audioLevel = Math.min(rms, 1.0);
        this.currentAudioLevel = audioLevel;

        callbacks.onAudioLevel?.(audioLevel);

        const now = Date.now();
        const threshold = this.isCalibrated ? this.adaptiveThreshold : 0.015;

        if (audioLevel > threshold) {
          this.silenceStartTime = null;
          this.lastSpeechTime = now;

          const interruptThreshold = threshold * 3.0;
          const isLoudEnoughToInterrupt = audioLevel > interruptThreshold;

          if (isFeatureEnabled('VOICE_STREAMING')) {
            const isPlaying = audioQueueService.getIsPlaying();
            if (isPlaying && !this.onHasInterruptedCheck?.() && isLoudEnoughToInterrupt) {
              logger.info(`[VAD] 🛑 User interrupting Atlas (level: ${(audioLevel * 100).toFixed(1)}%)`);
              audioQueueService.interrupt();
              this.onSetHasInterrupted?.(true);
              this.onSetInterruptTime?.(now);
              this.lastSpeechTime = null;
              this.silenceStartTime = null;
              this.onSetResumeAttempted?.(false);
            }
          } else if (!isFeatureEnabled('USE_AUDIO_PLAYBACK_SERVICE')) {
            // Legacy interrupt handling (handled by VoiceCallService via callback)
          }

          this.onStatusChange?.('listening');
        } else {
          if (this.silenceStartTime === null) {
            this.silenceStartTime = now;
          }

          const silenceDuration = now - this.silenceStartTime;
          const lastProcessTime = this.onGetLastProcessTime?.() ?? 0;
          const timeSinceLastProcess = now - lastProcessTime;
          const lastRejectedTime = this.onGetLastRejectedTime?.() ?? 0;
          const timeSinceRejection = now - lastRejectedTime;
          const recordingDuration = now - this.recordingStartTime;

          // Resume logic
          if (this.onHasInterruptedCheck?.() && this.onInterruptTimeGet?.() && !this.onGetResumeAttempted?.() && isFeatureEnabled('VOICE_STREAMING')) {
            const lastResumeCheckTime = this.onGetLastResumeCheckTime?.() ?? 0;
            const timeSinceLastCheck = now - lastResumeCheckTime;
            
            if (timeSinceLastCheck >= this.config.resumeCheckInterval) {
              this.onSetLastResumeCheckTime?.(now);
              const timeSinceInterrupt = now - (this.onInterruptTimeGet() ?? 0);

              if (silenceDuration >= 1000 && timeSinceInterrupt < 10000) {
                logger.info(`[VAD] ▶️ User stopped speaking after interrupt - resuming Atlas`);
                this.onSetResumeAttempted?.(true);
                audioQueueService.resume();
                this.onSetHasInterrupted?.(false);
                this.onSetInterruptTime?.(null);
                this.onSetResumeAttempted?.(false);
                this.onStatusChange?.('speaking');
                this.silenceStartTime = null;
                this.lastSpeechTime = null;
                return;
              }
            }
          }

          // Process speech detection
          const hasSpoken = this.lastSpeechTime !== null;
          const speechDuration = hasSpoken ? now - this.lastSpeechTime : 0;

          if (
            hasSpoken &&
            !this.onIsProcessingCheck?.() &&
            recordingDuration >= this.config.minRecordingDuration &&
            silenceDuration >= this.config.silenceDuration &&
            speechDuration >= this.config.minSpeechDuration &&
            timeSinceLastProcess >= 3000 &&
            timeSinceRejection >= 2000 &&
            this.mediaRecorder?.state === 'recording'
          ) {
            logger.debug('[VAD] 🤫 Silence detected - processing speech');
            this.onSetLastProcessTime?.(now);
            this.mediaRecorder.stop();
            this.silenceStartTime = null;
            this.lastSpeechTime = null;
          }
        }
      } catch (error) {
        logger.error('[VAD] VAD check error:', error);
      }
    };

    this.vadCheckInterval = setInterval(checkVAD, 50);
    logger.debug('[VAD] ✅ VAD monitoring started');
  }

  /**
   * Restart recording for next chunk
   */
  restart(): void {
    if (!this.onIsActiveCheck?.()) {
      logger.debug('[VAD] Skipping restart - call is not active');
      return;
    }

    if (!this.mediaRecorder) {
      logger.debug('[VAD] Skipping restart - mediaRecorder is null');
      return;
    }

    const isAtlasSpeaking = this.onGetIsAtlasSpeaking?.() ?? false;

    if (isAtlasSpeaking) {
      logger.debug('[VAD] Skipping recording - Atlas is still speaking');
      // Schedule retry (handled by VoiceCallService timeout management)
      return;
    }

    if (this.mediaRecorder.state === 'inactive') {
      if (!this.onIsActiveCheck?.()) {
        logger.debug('[VAD] Call ended while restarting - aborting');
        return;
      }

      this.silenceStartTime = null;
      this.lastSpeechTime = null;
      this.recordingStartTime = Date.now();

      try {
        this.mediaRecorder.start(100);
        logger.debug('[VAD] 🎙️ Mic restarted - ready for next input');
      } catch (error) {
        logger.error('[VAD] Error starting mediaRecorder:', error);
      }
    }
  }

  /**
   * Stop VAD and cleanup resources
   */
  async stop(): Promise<void> {
    if (this.vadCheckInterval) {
      clearInterval(this.vadCheckInterval);
      this.vadCheckInterval = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (error) {
        logger.warn('[VAD] Error stopping mediaRecorder:', error);
      }
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      this.stream = null;
    }

    if (this.microphone) {
      try {
        this.microphone.disconnect();
      } catch (error) {
        logger.warn('[VAD] Error disconnecting microphone:', error);
      }
      this.microphone = null;
    }

    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch (error) {
        logger.warn('[VAD] Error disconnecting analyser:', error);
      }
      this.analyser = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch (error) {
        logger.warn('[VAD] Error closing audioContext:', error);
      }
      this.audioContext = null;
    }

    // Reset state
    this.silenceStartTime = null;
    this.lastSpeechTime = null;
    this.isCalibrated = false;
    this.callbacks = undefined;
    this.mediaRecorder = null;

    logger.info('[VAD] ✅ VAD stopped and cleaned up');
  }

  /**
   * Check if recording is active
   */
  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  /**
   * Get current audio level (0-1)
   */
  getAudioLevel(): number {
    return this.currentAudioLevel;
  }

  /**
   * Get recording MIME type
   */
  getRecordingMimeType(): string {
    return this.recordingMimeType;
  }
}

