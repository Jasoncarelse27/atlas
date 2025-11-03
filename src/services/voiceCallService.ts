import { supabase } from '@/lib/supabaseClient';
import { getSafeUserMedia } from '@/utils/audioHelpers';
import { conversationBuffer } from '@/utils/conversationBuffer';
import { getApiEndpoint } from '@/utils/apiClient';
import { isFeatureEnabled } from '../config/featureFlags';
import { logger } from '../lib/logger';
import { captureException } from './sentryService';
import { audioQueueService } from './audioQueueService';
import { NetworkMonitoringService } from './voice/NetworkMonitoringService';
import { RetryService } from './voice/RetryService';
import { MessagePersistenceService } from './voice/MessagePersistenceService';
import { AudioPlaybackService } from './voice/AudioPlaybackService';
import { VADService } from './voice/VADService';
import { STTService } from './voice/STTService';
import { TTSService } from './voice/TTSService';
import { CallLifecycleService } from './voice/CallLifecycleService';
import { TimeoutManagementService } from './voice/TimeoutManagementService';

interface VoiceCallOptions {
  userId: string;
  conversationId: string;
  tier: 'studio';
  onTranscript: (text: string) => void;
  onAIResponse: (text: string) => void;
  onError: (error: Error) => void;
  onStatusChange?: (status: 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'reconnecting') => void;
  onAudioLevel?: (level: number) => void; // 0-1 for VAD feedback
}

export class VoiceCallService {
  private isActive = false;
  private isMuted: boolean = false; // ✅ FIX: Track mute state for VADService
  private mediaRecorder: MediaRecorder | null = null;
  private callStartTime: Date | null = null;
  private currentOptions: VoiceCallOptions | null = null;
  private maxCallDuration = 30 * 60 * 1000; // 30 minutes in milliseconds
  private durationCheckInterval: NodeJS.Timeout | null = null;
  private recordingMimeType: string = 'audio/webm'; // ✅ Store detected MIME type
  // EXTRACTION_POINT: RetryService
  // ✅ EXTRACTED: RetryService (with feature flag fallback)
  private retryService?: RetryService;
  
  // Legacy constants (kept for fallback when feature flag is off)
  private readonly RETRY_DELAYS = [1000, 2000, 4000, 8000, 10000]; // Exponential backoff: 1s, 2s, 4s, 8s, 10s
  private readonly MAX_RETRIES = 5; // ✅ IMPROVEMENT: Increased from 3 to 5 for better resilience
  // EXTRACTION_POINT: AudioPlaybackService
  // ✅ EXTRACTED: AudioPlaybackService (with feature flag fallback)
  private audioPlaybackService?: AudioPlaybackService;
  
  // Legacy state (kept for fallback when feature flag is off)
  private currentAudio: HTMLAudioElement | null = null; // ✅ Track current playing audio
  // EXTRACTION_POINT: TimeoutManagementService
  // ✅ EXTRACTED: TimeoutManagementService (with feature flag fallback)
  private timeoutManagementService?: TimeoutManagementService;
  private pendingTimeouts: Set<NodeJS.Timeout> = new Set(); // Legacy fallback
  
  // EXTRACTION_POINT: NetworkMonitoringService
  // ✅ EXTRACTED: NetworkMonitoringService (with feature flag fallback)
  private networkMonitoringService?: NetworkMonitoringService;
  
  // Legacy state (kept for fallback when feature flag is off)
  private networkQuality: 'excellent' | 'good' | 'poor' | 'offline' = 'excellent';
  private networkCheckInterval: NodeJS.Timeout | null = null;
  private recentApiLatencies: number[] = []; // Track recent API call latencies
  private readonly NETWORK_CHECK_INTERVAL = 5000; // Check every 5 seconds
  private readonly MAX_LATENCY_HISTORY = 10; // Keep last 10 latencies
  
  // EXTRACTION_POINT: VADService
  // ✅ EXTRACTED: VADService (with feature flag fallback)
  private vadService?: VADService;
  
  // Legacy VAD state (kept for fallback when feature flag is off)
  // 🎙️ CHATGPT-STYLE VAD (Voice Activity Detection)
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private vadCheckInterval: NodeJS.Timeout | null = null;
  private silenceStartTime: number | null = null;
  private readonly SILENCE_DURATION = 250; // 🎯 ChatGPT-like: Quick response after pause (0.25s)
  private readonly MIN_SPEECH_DURATION = 300; // 🎯 ChatGPT-like: Detect short utterances (0.3s)
  private lastSpeechTime: number | null = null; // ✅ FIX: Track if speech actually occurred
  private lastProcessTime: number = 0; // 🛑 Track last processing time to prevent loops
  private readonly MIN_PROCESS_INTERVAL = 500; // ✅ PHASE 2: Reduced to 500ms for ChatGPT-like responsiveness (ChatGPT target: < 1s)
  // ✅ PHASE 2: Natural conversation overlap tolerance
  private readonly OVERLAP_TOLERANCE = 200; // 200ms overlap is natural in real conversation
  private readonly YIELD_THRESHOLD = 500; // Yield turn after 500ms of continuous user speech
  private interruptStartTime: number | null = null; // Track when interrupt started for yield logic
  private lastRejectedTime: number = 0; // ✅ FIX: Track when audio was rejected to prevent immediate retry
  private readonly REJECTION_COOLDOWN = 2000; // ✅ FIX: 2s cooldown after rejecting small audio
  private interruptTime: number | null = null; // ✅ FIX: Track when interruption happened for resume logic
  private resumeAttempted: boolean = false; // ✅ Track if we've already attempted resume for this interrupt (prevents spam)
  private lastResumeCheckTime: number = 0; // ✅ OPTIMIZATION: Throttle resume checks to reduce CPU usage
  private readonly RESUME_CHECK_INTERVAL = 300; // ✅ OPTIMIZATION: 300ms throttle (industry standard: 200-300ms)
  private recordingStartTime: number = 0; // ✅ FIX: Track when recording started to prevent premature processing
  private interruptRecordingRestarted: boolean = false; // ✅ FIX: Track if recording was restarted for interrupt detection
  private readonly MIN_RECORDING_DURATION = 150; // ✅ FIX: Minimum 150ms recording before processing (allows chunks to collect)
  private isProcessing: boolean = false; // ✅ CRITICAL: Prevent concurrent processing (fixes double voice issue)
  
  // ✅ POLISH #5: Interrupt detection debounce
  private interruptDebounceTimer: NodeJS.Timeout | null = null;
  private readonly INTERRUPT_DEBOUNCE_MS = 50; // 50ms debounce to prevent false interrupts
  
  // ✅ POLISH #3: Call quality metrics tracking
  private callMetrics = {
    callDuration: 0,
    interruptionCount: 0,
    muteToggleCount: 0,
    errors: 0,
    sttLatencies: [] as number[],
    claudeLatencies: [] as number[],
    avgAudioLevel: 0,
    audioLevelSamples: [] as number[]
  };
  
  // 🎯 SMART ADAPTIVE THRESHOLD
  private baselineNoiseLevel: number = 0;
  private adaptiveThreshold: number = 0.02; // Starts at 2%, adjusts based on environment
  private isCalibrated: boolean = false;
  private hasInterrupted: boolean = false; // 🛑 Track if user already interrupted
  
  // EXTRACTION_POINT: CallLifecycleService
  // ✅ EXTRACTED: CallLifecycleService (with feature flag fallback)
  private callLifecycleService?: CallLifecycleService;
  
  // EXTRACTION_POINT: STTService
  // ✅ EXTRACTED: STTService (with feature flag fallback)
  private sttService?: STTService;
  
  // EXTRACTION_POINT: TTSService
  // ✅ EXTRACTED: TTSService (with feature flag fallback)
  private ttsService?: TTSService;
  
  async startCall(options: VoiceCallOptions): Promise<void> {
    if (this.isActive) {
      throw new Error('Call already in progress');
    }
    
    // Studio tier only
    if (options.tier !== 'studio') {
      throw new Error('Voice calls are only available for Studio tier');
    }
    
    // Initialize timeout management service
    if (isFeatureEnabled('USE_TIMEOUT_MANAGEMENT_SERVICE')) {
      if (!this.timeoutManagementService) {
        this.timeoutManagementService = new TimeoutManagementService();
        this.pendingTimeouts = this.timeoutManagementService.getPendingTimeouts();
      }
    }
    
    // Initialize call lifecycle service
    if (isFeatureEnabled('USE_CALL_LIFECYCLE_SERVICE')) {
      if (!this.callLifecycleService) {
        this.callLifecycleService = new CallLifecycleService(
          this.timeoutManagementService || new TimeoutManagementService(),
          { maxCallDuration: this.maxCallDuration }
        );
      }
      this.callLifecycleService.start({
        onCallStarted: () => logger.info('[VoiceCall] ✅ Call lifecycle started'),
        onCallStopped: (duration) => logger.info(`[VoiceCall] ✅ Call lifecycle stopped (${duration.toFixed(1)}s)`),
        onMaxDurationReached: () => {
          logger.warn('[VoiceCall] ⏰ Maximum call duration reached');
          const error = new Error('Maximum call duration reached (30 minutes)');
          captureException(error, { 
            feature: 'voice_call',
            error_type: 'max_duration',
            call_duration: this.callStartTime ? Date.now() - this.callStartTime.getTime() : 0
          });
          this.stopCall(options.userId);
          options.onError(error);
        },
      });
    }
    
    this.isActive = true;
    this.callStartTime = new Date();
    this.currentOptions = options;
    
    // ✅ POLISH #1: Restore mute preference from localStorage
    try {
      const savedMuteState = localStorage.getItem('atlas_voice_mute_preference');
      if (savedMuteState === 'true') {
        this.toggleMute(true);
        logger.debug('[VoiceCall] 🔇 Restored mute preference from previous call');
      }
    } catch (error) {
      // Silently fail if localStorage unavailable
      logger.debug('[VoiceCall] Could not restore mute preference:', error);
    }
    
    // ✅ IMPROVEMENT: Start network quality monitoring
    if (isFeatureEnabled('USE_NETWORK_MONITORING_SERVICE')) {
      // Use extracted NetworkMonitoringService
      if (!this.networkMonitoringService) {
        this.networkMonitoringService = new NetworkMonitoringService({}, this.pendingTimeouts);
      }
      this.networkMonitoringService.setActive(true);
      this.networkMonitoringService.start({
        onQualityChange: (quality, previousQuality) => {
          // Map to VoiceCallService status callbacks
          if ((quality === 'poor' || quality === 'offline') && previousQuality !== 'poor' && previousQuality !== 'offline') {
            options.onStatusChange?.('reconnecting');
          } else if ((quality === 'excellent' || quality === 'good') && (previousQuality === 'poor' || previousQuality === 'offline')) {
            options.onStatusChange?.('listening');
          }
        },
      });
    } else {
      // Legacy implementation
      this.startNetworkMonitoring();
    }
    
    // Start 30-minute duration enforcement (legacy fallback)
    if (!isFeatureEnabled('USE_CALL_LIFECYCLE_SERVICE')) {
      this.durationCheckInterval = isFeatureEnabled('USE_TIMEOUT_MANAGEMENT_SERVICE') && this.timeoutManagementService
        ? this.timeoutManagementService.setInterval(() => {
            if (this.callStartTime) {
              const elapsed = Date.now() - this.callStartTime.getTime();
              if (elapsed >= this.maxCallDuration) {
                logger.warn('[VoiceCall] ⏰ Maximum call duration reached (30 minutes)');
                this.stopCall(options.userId);
                options.onError(new Error('Maximum call duration reached (30 minutes)'));
              }
            }
          }, 30000)
        : setInterval(() => {
            if (this.callStartTime) {
              const elapsed = Date.now() - this.callStartTime.getTime();
              if (elapsed >= this.maxCallDuration) {
                logger.warn('[VoiceCall] ⏰ Maximum call duration reached (30 minutes)');
                this.stopCall(options.userId);
                options.onError(new Error('Maximum call duration reached (30 minutes)'));
              }
            }
          }, 30000);
    }
    
    // Start recording loop with VAD
    if (isFeatureEnabled('USE_VAD_SERVICE')) {
      // Use extracted VADService
      if (!this.vadService) {
        this.vadService = new VADService();
        // Set up shared state callbacks for synchronization
        this.vadService.setSharedStateCallbacks({
          onIsProcessingCheck: () => this.isProcessing,
          onIsActiveCheck: () => this.isActive,
          onHasInterruptedCheck: () => this.hasInterrupted,
          onInterruptTimeGet: () => this.interruptTime,
          onSetHasInterrupted: (value) => { this.hasInterrupted = value; },
          onSetInterruptTime: (value) => { this.interruptTime = value; },
          onSetResumeAttempted: (value) => { this.resumeAttempted = value; },
          onGetResumeAttempted: () => this.resumeAttempted,
          onSetLastResumeCheckTime: (value) => { this.lastResumeCheckTime = value; },
          onGetLastResumeCheckTime: () => this.lastResumeCheckTime,
          onSetLastProcessTime: (value) => { this.lastProcessTime = value; },
          onGetLastProcessTime: () => this.lastProcessTime,
          onSetLastRejectedTime: (value) => { this.lastRejectedTime = value; },
          onGetLastRejectedTime: () => this.lastRejectedTime,
          onSetIsProcessing: (value) => { this.isProcessing = value; },
          onGetIsAtlasSpeaking: () => {
            return (isFeatureEnabled('USE_AUDIO_PLAYBACK_SERVICE') && this.audioPlaybackService?.isPlaying()) ||
                   (!isFeatureEnabled('USE_AUDIO_PLAYBACK_SERVICE') && this.currentAudio && !this.currentAudio.paused) ||
                   (isFeatureEnabled('VOICE_STREAMING') && audioQueueService.getIsPlaying());
          },
          onGetIsMutedCheck: () => this.isMuted, // ✅ FIX: Pass mute state to VADService
          onStatusChange: options.onStatusChange,
          onAudioLevel: (level: number) => {
            // ✅ POLISH #3: Track audio level samples (sample every 10th reading to avoid too much data)
            if (this.callMetrics.audioLevelSamples.length < 1000) { // Limit to 1000 samples
              this.callMetrics.audioLevelSamples.push(level);
            }
            // Pass to original callback
            options.onAudioLevel?.(level);
          },
          onRecordingStopped: async (audioBlob: Blob, mimeType: string) => {
            this.recordingMimeType = mimeType;
            await this.processVoiceChunk(audioBlob, options);
          },
        });
        
        // ✅ POLISH #7: Set network quality callback for adaptive buffer size
        this.vadService.setNetworkQualityCallback(() => {
          if (isFeatureEnabled('USE_NETWORK_MONITORING_SERVICE') && this.networkMonitoringService) {
            return this.networkMonitoringService.getQuality();
          }
          return this.networkQuality;
        });
      }
      
      await this.vadService.startRecording({
        onAudioLevel: options.onAudioLevel,
        onRecordingStopped: async (audioBlob: Blob) => {
          await this.processVoiceChunk(audioBlob, options);
        },
      });
    } else {
      // Legacy implementation
      await this.startRecordingWithVAD(options);
    }
    
    logger.info('[VoiceCall] ✅ Call started with ChatGPT-style VAD');
  }
  
  /**
   * Toggle mute state
   * @param desiredState Optional desired mute state. If not provided, toggles current state.
   */
  toggleMute(desiredState?: boolean): boolean {
    if (desiredState !== undefined) {
      // ✅ FIX: Sync with desired state (from UI track state)
      this.isMuted = desiredState;
    } else {
      // Toggle if no desired state provided
      this.isMuted = !this.isMuted;
    }
    
    // ✅ POLISH #1: Persist mute preference to localStorage
    try {
      localStorage.setItem('atlas_voice_mute_preference', String(this.isMuted));
    } catch (error) {
      // Silently fail if localStorage unavailable (e.g., private browsing)
      logger.debug('[VoiceCall] Could not persist mute preference:', error);
    }
    
    // ✅ POLISH #3: Track mute toggle
    this.callMetrics.muteToggleCount++;
    
    logger.debug(`[VoiceCall] Mute toggled: ${this.isMuted ? 'muted' : 'unmuted'}`);
    return this.isMuted;
  }
  
  async stopCall(userId: string): Promise<void> {
    if (!this.isActive) {
      logger.debug('[VoiceCall] stopCall called but call is not active');
      return;
    }
    
    logger.info('[VoiceCall] 🛑 Stopping call...');
    this.isActive = false; // ✅ CRITICAL: Set this FIRST to prevent any new operations
    
    // Stop call lifecycle service
    if (isFeatureEnabled('USE_CALL_LIFECYCLE_SERVICE') && this.callLifecycleService) {
      this.callLifecycleService.stop();
    }
    
    // ✅ CRITICAL FIX: Clear ALL pending timeouts immediately
    this.pendingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.pendingTimeouts.clear();
    
    // ✅ POLISH #5: Clear interrupt debounce timer
    if (this.interruptDebounceTimer) {
      clearTimeout(this.interruptDebounceTimer);
      this.interruptDebounceTimer = null;
    }
    
    // ✅ IMPROVEMENT: Stop network monitoring
    if (isFeatureEnabled('USE_NETWORK_MONITORING_SERVICE') && this.networkMonitoringService) {
      this.networkMonitoringService.stop();
      this.networkMonitoringService.setActive(false);
    } else {
      // Legacy implementation
      this.stopNetworkMonitoring();
    }
    
    // Clear duration check interval
    if (this.durationCheckInterval) {
      if (isFeatureEnabled('USE_TIMEOUT_MANAGEMENT_SERVICE') && this.timeoutManagementService) {
        this.timeoutManagementService.clearInterval(this.durationCheckInterval);
      } else {
        clearInterval(this.durationCheckInterval);
      }
      this.durationCheckInterval = null;
    }
    
    // ✅ CRITICAL FIX: Stop audio queue immediately
    audioQueueService.interrupt();
    audioQueueService.reset();
    
    // ✅ FIX: Stop any playing audio when call ends
    if (isFeatureEnabled('USE_AUDIO_PLAYBACK_SERVICE') && this.audioPlaybackService) {
      this.audioPlaybackService.stop();
    } else {
      // Legacy implementation
      if (this.currentAudio && !this.currentAudio.paused) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio = null;
      }
    }
    
    // Stop VAD service or legacy VAD
    if (isFeatureEnabled('USE_VAD_SERVICE') && this.vadService) {
      await this.vadService.stop();
      // VADService manages mediaRecorder internally, no need to access it
    } else {
      // Legacy VAD cleanup
      // Clear VAD check interval
      if (this.vadCheckInterval) {
        clearInterval(this.vadCheckInterval);
        this.vadCheckInterval = null;
      }
      
      // ✅ CRITICAL FIX: Stop recording IMMEDIATELY and cleanup stream
      if (this.mediaRecorder) {
        try {
          if (this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
          }
          // Stop all tracks from the stream
          if (this.mediaRecorder.stream) {
            this.mediaRecorder.stream.getTracks().forEach(track => {
              track.stop();
              track.enabled = false;
            });
          }
        } catch (error) {
          logger.warn('[VoiceCall] Error stopping mediaRecorder:', error);
        }
        this.mediaRecorder = null;
      }
      
      // Cleanup VAD audio context
      if (this.microphone) {
        try {
          this.microphone.disconnect();
        } catch (error) {
          logger.warn('[VoiceCall] Error disconnecting microphone:', error);
        }
        this.microphone = null;
      }
      if (this.analyser) {
        try {
          this.analyser.disconnect();
        } catch (error) {
          logger.warn('[VoiceCall] Error disconnecting analyser:', error);
        }
        this.analyser = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        try {
          await this.audioContext.close();
        } catch (error) {
          logger.warn('[VoiceCall] Error closing audioContext:', error);
        }
        this.audioContext = null;
      }
    }
    
    // Track call in usage logs
    if (this.callStartTime) {
      const duration = (Date.now() - this.callStartTime.getTime()) / 1000;
      await this.trackCallMetering(userId, duration);
      
      // ✅ POLISH #3: Calculate and send call quality metrics
      this.callMetrics.callDuration = duration;
      
      // Calculate average latencies
      const avgSTTLatency = this.callMetrics.sttLatencies.length > 0
        ? this.callMetrics.sttLatencies.reduce((a, b) => a + b, 0) / this.callMetrics.sttLatencies.length
        : 0;
      const avgClaudeLatency = this.callMetrics.claudeLatencies.length > 0
        ? this.callMetrics.claudeLatencies.reduce((a, b) => a + b, 0) / this.callMetrics.claudeLatencies.length
        : 0;
      const avgLatency = avgSTTLatency + avgClaudeLatency;
      
      // ✅ Error rate tracking (target: < 2%)
      const totalInteractions = this.callMetrics.sttLatencies.length;
      const errorRate = totalInteractions > 0 
        ? (this.callMetrics.errors / totalInteractions) * 100 
        : 0;
      
      // Log error rate warning if above target
      if (errorRate > 2) {
        logger.warn(`[VoiceCall] ⚠️ Error rate above target: ${errorRate.toFixed(1)}% (target: < 2%)`);
        captureException(new Error(`Voice call error rate above target: ${errorRate.toFixed(1)}%`), {
          feature: 'voice_call',
          error_type: 'high_error_rate',
          error_rate: errorRate,
          total_interactions: totalInteractions,
          total_errors: this.callMetrics.errors,
          call_duration: duration
        });
      }
      
      // Calculate average audio level
      const avgAudioLevel = this.callMetrics.audioLevelSamples.length > 0
        ? this.callMetrics.audioLevelSamples.reduce((a, b) => a + b, 0) / this.callMetrics.audioLevelSamples.length
        : 0;
      
      // Send to analytics
      const { analytics } = await import('../lib/analytics');
      analytics.track({
        name: 'voice_call_quality',
        properties: {
          callDuration: duration,
          averageLatency: avgLatency,
          avgSTTLatency,
          avgClaudeLatency,
          errorRate: errorRate.toFixed(1) + '%',
          totalInteractions,
          interruptionCount: this.callMetrics.interruptionCount,
          muteToggleCount: this.callMetrics.muteToggleCount,
          errors: this.callMetrics.errors,
          avgAudioLevel,
          userId
        }
      });
      
      logger.info(`[VoiceCall] 📊 Call metrics: ${duration.toFixed(1)}s, ${avgLatency.toFixed(0)}ms avg latency, ${this.callMetrics.interruptionCount} interrupts`);
    }
    
    // Clear conversation buffer
    conversationBuffer.clear();
    
    // ✅ POLISH #3: Reset metrics for next call
    this.callMetrics = {
      callDuration: 0,
      interruptionCount: 0,
      muteToggleCount: 0,
      errors: 0,
      sttLatencies: [],
      claudeLatencies: [],
      avgAudioLevel: 0,
      audioLevelSamples: []
    };
    
    // Clear all timeouts
    if (isFeatureEnabled('USE_TIMEOUT_MANAGEMENT_SERVICE') && this.timeoutManagementService) {
      this.timeoutManagementService.clearAll();
    } else {
      // Legacy cleanup
      this.pendingTimeouts.forEach(timeout => clearTimeout(timeout));
      this.pendingTimeouts.clear();
    }
    
    // ✅ CRITICAL FIX: Reset all state flags
    this.hasInterrupted = false;
    this.interruptTime = null;
    this.interruptStartTime = null; // ✅ PHASE 2: Reset overlap/yield tracking
    this.resumeAttempted = false; // ✅ CRITICAL: Reset resume flag on stop
    this.interruptRecordingRestarted = false; // ✅ FIX: Reset interrupt recording flag
    this.lastSpeechTime = null;
    this.isProcessing = false; // ✅ CRITICAL: Reset processing flag on stop
    this.isMuted = false; // ✅ FIX: Reset mute state on stop
    this.silenceStartTime = null;
    this.lastProcessTime = 0;
    this.lastRejectedTime = 0;
    
    this.currentOptions = null;
    logger.info('[VoiceCall] ✅ Call ended - all resources cleaned up');
  }
  
  /**
   * 🚀 CHATGPT-STYLE: Voice Activity Detection Recording
   * Detects when user stops speaking and processes immediately
   * EXTRACTION_POINT: VADService
   * TODO: Extract to VADService.startRecording()
   */
  private async startRecordingWithVAD(options: VoiceCallOptions): Promise<void> {
    try {
      // Get microphone stream
      const stream = await getSafeUserMedia({ audio: true });
      
      // Setup Web Audio API for VAD
      this.audioContext = new AudioContext();
      
      // ✅ FIX: Resume audio context if suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        logger.info('[VoiceCall] 🔄 Resuming suspended audio context...');
        await this.audioContext.resume();
        logger.info(`[VoiceCall] ✅ Audio context state: ${this.audioContext.state}`);
      }
      
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8; // Smooth out noise
      
      this.microphone.connect(this.analyser);
      
      // ✅ DIAGNOSTIC: Check if stream has active audio tracks
      const audioTracks = stream.getAudioTracks();
      logger.info(`[VoiceCall] 🎤 Audio tracks: ${audioTracks.length}`);
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        logger.info(`[VoiceCall] 🎤 Track enabled: ${track.enabled}, muted: ${track.muted}, readyState: ${track.readyState}`);
        
        // ✅ CRITICAL FIX: Ensure track is enabled
        if (!track.enabled) {
          logger.warn('[VoiceCall] ⚠️ Microphone track is disabled - enabling');
          track.enabled = true;
        }
        
        // ✅ CRITICAL FIX: Check if track is muted, but verify with actual audio levels
        // Sometimes macOS shows muted but audio still works (false positive)
        if (track.muted) {
          logger.warn('[VoiceCall] ⚠️ Track reports muted, testing actual audio levels...');
          
          // ✅ CRITICAL FIX: Ensure AudioContext is running before testing
          if (this.audioContext && this.audioContext.state !== 'running') {
            logger.info(`[VoiceCall] 🔄 AudioContext state: ${this.audioContext.state}, resuming...`);
            await this.audioContext.resume();
            // Wait for state to stabilize
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // ✅ CRITICAL FIX: Wait for audio pipeline to stabilize (analyser needs time to collect data)
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // ✅ IMPROVEMENT: Test if audio is actually coming through despite muted flag
          // macOS sometimes shows muted but audio still works
          let audioDetected = false;
          let maxRms = 0;
          
          // Check every 100ms for 1 second (10 checks)
          for (let check = 0; check < 10; check++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (!this.analyser || !this.audioContext || this.audioContext.state !== 'running') {
              logger.error(`[VoiceCall] Cannot test - analyser: ${!!this.analyser}, context state: ${this.audioContext?.state || 'null'}`);
              continue;
            }
            
            // ✅ CRITICAL BUG FIX: Use fftSize, NOT frequencyBinCount for time domain data
            // frequencyBinCount is for frequency analysis, fftSize is for time domain
            const dataArray = new Uint8Array(this.analyser.fftSize);
            this.analyser.getByteTimeDomainData(dataArray);
            
            // Calculate RMS for audio level
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const normalized = (dataArray[i] - 128) / 128;
              sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            maxRms = Math.max(maxRms, rms);
            
            // ✅ IMPROVEMENT: Lower threshold for initial detection (0.005 = 0.5%)
            // Some microphones have very low baseline even when working
            if (rms > 0.005) {
              audioDetected = true;
              logger.info(`[VoiceCall] ✅ Audio detected despite muted flag (RMS: ${rms.toFixed(4)}, check ${check + 1}/10)`);
              break;
            }
            
            // Log every 3rd check for debugging
            if (check % 3 === 0) {
              logger.debug(`[VoiceCall] Audio test check ${check + 1}/10: RMS=${rms.toFixed(4)}, context=${this.audioContext.state}`);
            }
          }
          
          if (!audioDetected) {
            logger.error(`[VoiceCall] ❌ No audio detected - max RMS: ${maxRms.toFixed(4)} (threshold: 0.005)`);
            logger.error('[VoiceCall] ❌ Diagnostic:', {
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState,
              label: track.label,
              audioContextState: this.audioContext?.state || 'null',
              analyserReady: !!this.analyser,
            });
            
            // Stop the call and show error to user with specific macOS guidance
            options.onError(new Error(
              'Microphone is muted at system level.\n\n' +
              'Quick Fix:\n' +
              '1. Press F10 (or Fn+F10) - hardware mute toggle\n' +
              '2. Check macOS Sound → Input\n' +
              '   • See if input level circles light up when you speak\n' +
              '   • If circles stay dark = hardware mute is ON\n\n' +
              '3. Check Control Center (top-right menu bar)\n' +
              '   • Look for microphone icon\n' +
              '   • Ensure it\'s not muted\n\n' +
              'After fixing, refresh the page and try again.'
            ));
            await this.stopCall(options.userId);
            return;
          } else {
            logger.info(`[VoiceCall] ✅ Audio working despite muted flag - continuing (detected RMS: ${maxRms.toFixed(4)})`);
            // Continue - audio is actually working
          }
        }
      }
      
      // 🎯 SMART THRESHOLD: Calibrate ambient noise for first 2 seconds BEFORE starting VAD
      await this.calibrateAmbientNoise();
      
      // Create MediaRecorder for audio capture
      // Try to use webm/opus format for better compatibility with Deepgram
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg;codecs=opus'; // Fallback
      
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000  // 128kbps
      });
      
      this.recordingMimeType = this.mediaRecorder.mimeType || mimeType;
      logger.info(`[VoiceCall] 🎙️ VAD enabled with format: ${this.recordingMimeType}`);
      
      // Audio chunk collection
      let audioChunks: Blob[] = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = async () => {
        if (!this.isActive) {
          logger.debug('[VoiceCall] MediaRecorder stopped but call is inactive');
          audioChunks = [];
          return;
        }
        
        if (audioChunks.length === 0) {
          logger.debug('[VoiceCall] No audio chunks collected - restarting recorder');
          // ✅ FIX: Restart recording instead of returning - allows conversation to continue
          this.restartRecordingVAD();
          return;
        }
        
        const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        
        // ✅ LOWERED THRESHOLD: 800 → 200 bytes (catch quiet speech)
        if (totalSize < 200) {
          logger.debug(`[VoiceCall] 🤫 Too quiet (${totalSize} bytes) - waiting for louder speech...`);
          audioChunks = [];
          this.restartRecordingVAD();
          return;
        }
        
        const audioBlob = new Blob(audioChunks, { type: this.recordingMimeType });
        audioChunks = [];
        
        logger.debug(`[VoiceCall] 📦 Processing audio chunk: ${(audioBlob.size / 1024).toFixed(1)}KB`);
        
        // ✅ CRITICAL: Prevent concurrent processing (fixes double voice issue)
        if (this.isProcessing) {
          logger.debug('[VoiceCall] ⚠️ Already processing - skipping duplicate chunk');
          audioChunks = [];
          // ✅ CRITICAL: Don't restart mic here - wait for current processing to complete
          // The current processing will restart the mic when done
          return;
        }
        
        // ✅ CRITICAL: Set processing flag BEFORE async call to prevent race conditions
        this.isProcessing = true;
        
        try {
        // Process the chunk
        await this.processVoiceChunk(audioBlob, options);
        
        // Restart recording
        this.restartRecordingVAD();
        } catch (error) {
          // ✅ CRITICAL: Clear processing flag on error
          this.isProcessing = false;
          logger.error('[VoiceCall] Error processing chunk:', error);
          
          // ✅ CRITICAL FIX: If Atlas was interrupted and chunk processing failed,
          // resume Atlas's response - user didn't actually speak (cough/sneeze/noise)
          if (this.hasInterrupted && this.interruptTime && isFeatureEnabled('VOICE_STREAMING')) {
            const timeSinceInterrupt = Date.now() - this.interruptTime;
            // ✅ FIX: Increase window to 5 seconds for retry scenarios (was 2s)
            if (timeSinceInterrupt < 5000) {
              logger.info('[VoiceCall] ▶️ Chunk error after interrupt - resuming Atlas (likely rejected cough/sneeze/noise)');
              audioQueueService.resume();
              this.hasInterrupted = false;
              this.interruptTime = null;
              this.currentOptions?.onStatusChange?.('speaking');
              // Still restart recording for next input
              this.restartRecordingVAD();
              return;
            }
          }
          
          // ✅ FIX: Don't end call on processing errors - just restart recording
          this.isProcessing = false; // ✅ CRITICAL: Clear flag on error
          this.restartRecordingVAD();
        }
      };
      
      // Start VAD monitoring AFTER calibration
      this.startVADMonitoring(options);
      
      // ✅ FIX: Initialize speech tracking
      this.lastSpeechTime = null;
      this.silenceStartTime = null;
      this.lastProcessTime = 0;
      this.lastRejectedTime = 0;
      this.recordingStartTime = Date.now(); // ✅ FIX: Track recording start time
      
      // Start recording
      this.mediaRecorder.start(100);
      logger.debug('[VoiceCall] 🎙️ Recording started, waiting for speech...');
      
    } catch (error) {
      logger.error('[VoiceCall] Recording setup failed:', error);
      this.isActive = false;
      const friendlyError = error instanceof Error && error.message.includes('Permission denied')
        ? new Error('Microphone access denied. Please allow microphone permissions.')
        : error instanceof Error
        ? error
        : new Error('Failed to access microphone');
      options.onError(friendlyError);
    }
  }
  
  /**
   * 🎯 SMART ADAPTIVE THRESHOLD: Calibrate to ambient noise
   * ✅ FIX: Use getByteTimeDomainData for accurate volume detection
   * EXTRACTION_POINT: VADService
   * TODO: Extract to VADService.calibrate()
   */
  private async calibrateAmbientNoise(): Promise<void> {
    if (!this.analyser) {
      logger.error('[VoiceCall] ❌ Cannot calibrate - analyser not initialized');
      return;
    }
    
    if (!this.audioContext || this.audioContext.state !== 'running') {
      logger.warn(`[VoiceCall] ⚠️ Audio context not running: ${this.audioContext?.state || 'null'}`);
    }
    
    logger.info('[VoiceCall] 🔧 Calibrating ambient noise level...');
    
    const samples: number[] = [];
    const dataArray = new Uint8Array(this.analyser.fftSize);
    
    // Collect 20 samples over 2 seconds
    for (let i = 0; i < 20; i++) {
      // ✅ FIX: Use getByteTimeDomainData for volume, not frequency
      this.analyser.getByteTimeDomainData(dataArray);
      
      // ✅ DIAGNOSTIC: Check if data array has any variation
      const min = Math.min(...dataArray);
      const max = Math.max(...dataArray);
      const variation = max - min;
      
      // Calculate RMS (Root Mean Square) for accurate volume
      let sum = 0;
      for (let j = 0; j < dataArray.length; j++) {
        const normalized = (dataArray[j] - 128) / 128; // Convert to -1 to 1
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      samples.push(rms);
      
      // ✅ DIAGNOSTIC: Log first few samples with more detail
      if (i < 3) {
        logger.debug(`[VoiceCall] Sample ${i + 1}/20: ${(rms * 100).toFixed(2)}% | Data range: ${min}-${max} (variation: ${variation})`);
      } else {
        logger.debug(`[VoiceCall] Sample ${i + 1}/20: ${(rms * 100).toFixed(2)}%`);
      }
      
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Calculate baseline (median to avoid outliers)
    samples.sort((a, b) => a - b);
    this.baselineNoiseLevel = samples[Math.floor(samples.length / 2)];
    
    // ✅ FIX: Lower multiplier for better sensitivity (was 2.5x, now 1.8x)
    // Users shouldn't have to speak really loud - 1.8x is enough to filter noise
    // Minimum threshold lowered from 2% to 1.5% for quieter environments
    this.adaptiveThreshold = Math.max(this.baselineNoiseLevel * 1.8, 0.015);
    this.isCalibrated = true;
    
    logger.info(`[VoiceCall] ✅ Calibrated - Baseline: ${(this.baselineNoiseLevel * 100).toFixed(1)}%, Threshold: ${(this.adaptiveThreshold * 100).toFixed(1)}%`);
    
    // ✅ DIAGNOSTIC: Warn if baseline is suspiciously low
    if (this.baselineNoiseLevel < 0.001) {
      logger.warn('[VoiceCall] ⚠️ Very low baseline detected - microphone may not be working properly');
    }
  }
  
  /**
   * 🔊 VAD Monitoring: Detect when user starts/stops speaking
   * EXTRACTION_POINT: VADService
   * TODO: Extract to VADService.startMonitoring()
   */
  private startVADMonitoring(options: VoiceCallOptions): void {
    if (!this.analyser) {
      logger.error('[VoiceCall] ❌ Cannot start VAD - analyser not initialized');
      options.onError(new Error('Audio analyser not initialized'));
      return;
    }
    
    // ✅ FIX: Use fftSize for time domain data (not frequencyBinCount)
    const dataArray = new Uint8Array(this.analyser.fftSize);
    
    const checkVAD = () => {
      if (!this.isActive || !this.analyser) return;
      
      // ✅ CRITICAL FIX: Allow interrupts while Atlas is speaking
      // Check if Atlas is speaking but keep monitoring for user interrupts
      const isAtlasSpeaking = 
        (isFeatureEnabled('USE_AUDIO_PLAYBACK_SERVICE') && this.audioPlaybackService?.isPlaying()) ||
        (!isFeatureEnabled('USE_AUDIO_PLAYBACK_SERVICE') && this.currentAudio && !this.currentAudio.paused) || 
        (isFeatureEnabled('VOICE_STREAMING') && audioQueueService.getIsPlaying());
      
      // ✅ FIX: Restart recording after Atlas starts speaking (with delay to prevent feedback)
      // This allows detection of user interrupts while Atlas is speaking
      if (isAtlasSpeaking && this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
        // Atlas is speaking but recording stopped - restart after brief delay for interrupt detection
        if (!this.interruptRecordingRestarted) {
          this.interruptRecordingRestarted = true;
          this.createTimeout(() => {
            if (this.isActive && this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
              try {
                this.mediaRecorder.start(100);
                logger.debug('[VoiceCall] 🎙️ Restarted recording for interrupt detection while Atlas speaks');
              } catch (error) {
                logger.warn('[VoiceCall] Failed to restart recording for interrupts:', error);
              }
            }
          }, 500); // 500ms delay to prevent feedback from Atlas's voice
        }
      } else if (!isAtlasSpeaking) {
        // Reset flag when Atlas stops speaking
        this.interruptRecordingRestarted = false;
      }
      
      try {
        // ✅ FIX: Use getByteTimeDomainData for accurate volume detection
        this.analyser.getByteTimeDomainData(dataArray);
        
        // Calculate RMS (Root Mean Square) for accurate volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = (dataArray[i] - 128) / 128; // Convert to -1 to 1
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const audioLevel = Math.min(rms, 1.0); // Clamp to 0-1
      
      // Send audio level to UI for visualization
      options.onAudioLevel?.(audioLevel);
      
      const now = Date.now();
      
      // 🎯 Use adaptive threshold (or default if not calibrated yet)
        // ✅ FIX: Lower default threshold for better sensitivity (was 0.02, now 0.015)
        const threshold = this.isCalibrated ? this.adaptiveThreshold : 0.015;
      
      // Detect speech vs silence
      // ✅ SIMPLIFIED: Let Deepgram confidence handle noise detection (it's already very good)
      // Frequency analysis was over-engineered - Deepgram's confidence scores are sufficient
      if (audioLevel > threshold) {
        // User is speaking (or making noise - Deepgram will filter it)
        this.silenceStartTime = null;
        this.lastSpeechTime = now;
        
        // ✅ CRITICAL FIX: Use adaptive interrupt threshold based on Atlas speaking state
        // When Atlas is speaking, use much higher threshold to prevent speaker bleed feedback
        const isAtlasSpeaking = 
          (isFeatureEnabled('USE_AUDIO_PLAYBACK_SERVICE') && this.audioPlaybackService?.isPlaying()) ||
          (!isFeatureEnabled('USE_AUDIO_PLAYBACK_SERVICE') && this.currentAudio && !this.currentAudio.paused) || 
          (isFeatureEnabled('VOICE_STREAMING') && audioQueueService.getIsPlaying());
        
        // ✅ CRITICAL: Use 10.0x multiplier when Atlas is speaking (prevents TTS feedback)
        // Atlas TTS from speakers produces ~8-25% audio levels, so need threshold > 25%
        // User speaking directly into mic while Atlas plays should be > 30-40% (true interrupt)
        const interruptThreshold = isAtlasSpeaking 
          ? threshold * 10.0  // High threshold when Atlas speaks (filters speaker bleed)
          : threshold * 2.0;  // Normal threshold when Atlas is silent (fast response)
        
        const isLoudEnoughToInterrupt = audioLevel > interruptThreshold;
        
        if (isFeatureEnabled('VOICE_STREAMING')) {
          // Check if Atlas is currently speaking
            const isPlaying = audioQueueService.getIsPlaying();
            
            if (isPlaying && isLoudEnoughToInterrupt) {
              // ✅ POLISH #5: Debounce interrupt detection (50ms) to prevent false interrupts
              if (this.interruptDebounceTimer) {
                clearTimeout(this.interruptDebounceTimer);
              }
              
              this.interruptDebounceTimer = setTimeout(() => {
                // ✅ PHASE 2: Natural conversation overlap tolerance
                if (!this.hasInterrupted) {
                  // First detection - start overlap tolerance window
                  if (!this.interruptStartTime) {
                    this.interruptStartTime = Date.now();
                    logger.debug(`[VoiceCall] 🔄 Overlap tolerance started (${this.OVERLAP_TOLERANCE}ms window)`);
                  } else {
                    // Check if overlap tolerance window has passed
                    const overlapDuration = Date.now() - this.interruptStartTime;
                    if (overlapDuration >= this.OVERLAP_TOLERANCE) {
                      // ✅ PHASE 2: Overlap tolerance passed - interrupt now (natural conversation flow)
                      logger.info(`[VoiceCall] 🛑 User interrupting Atlas after ${overlapDuration.toFixed(0)}ms overlap (level: ${(audioLevel * 100).toFixed(1)}% > ${(interruptThreshold * 100).toFixed(1)}%)`);
              audioQueueService.interrupt(); // Pause queue playback (allows resume)
            this.hasInterrupted = true;
                      this.interruptTime = Date.now();
                      
                      // ✅ POLISH #3: Track interruption
                      this.callMetrics.interruptionCount++;
                      this.lastSpeechTime = null;
                      this.silenceStartTime = null;
              logger.info(`[VoiceCall] 🛑 User interrupted - pausing queue (can resume) - interruptTime: ${this.interruptTime}`);
            this.resumeAttempted = false; // ✅ CRITICAL: Reset resume flag on new interrupt
                      // Keep interruptStartTime for yield tracking
                    }
                  }
                } else if (this.hasInterrupted && this.interruptStartTime) {
                  // Already interrupted - check if we should yield (user speaking for >500ms)
                  const interruptDuration = Date.now() - this.interruptStartTime;
                  if (interruptDuration >= this.YIELD_THRESHOLD && !this.resumeAttempted) {
                    // ✅ PHASE 2: User has been speaking for 500ms - yield turn (don't resume)
                    logger.info(`[VoiceCall] 🛑 User yield threshold reached (${interruptDuration.toFixed(0)}ms) - yielding turn`);
                    this.resumeAttempted = true; // Prevent resume - user owns the turn
                    this.interruptStartTime = null; // Reset for next interrupt
                  }
                }
                this.interruptDebounceTimer = null;
              }, this.INTERRUPT_DEBOUNCE_MS);
          }
        } else if (
          !isFeatureEnabled('USE_AUDIO_PLAYBACK_SERVICE') && 
          this.currentAudio && 
          !this.currentAudio.paused && 
          !this.hasInterrupted && 
          isLoudEnoughToInterrupt
        ) {
            // ✅ POLISH #5: Debounce interrupt for legacy mode too
            if (this.interruptDebounceTimer) {
              clearTimeout(this.interruptDebounceTimer);
            }
            
            this.interruptDebounceTimer = setTimeout(() => {
            // User interrupted! Pause Atlas immediately (don't reset currentTime - allows resume)
              this.currentAudio?.pause();
            // ✅ FIX: Don't reset currentTime - allows resume from same position
          this.hasInterrupted = true;
              
              // ✅ POLISH #3: Track interruption (legacy mode)
              this.callMetrics.interruptionCount++;
              
              this.interruptTime = Date.now();
            this.resumeAttempted = false; // ✅ CRITICAL: Reset resume flag on new interrupt
            // ✅ FIX: Reset speech tracking on interrupt - don't process interrupt speech
            this.lastSpeechTime = null; // Clear any speech during interrupt
            this.silenceStartTime = null; // Reset silence tracking
              this.interruptDebounceTimer = null;
            }, this.INTERRUPT_DEBOUNCE_MS);
        }
        options.onStatusChange?.('listening');
      } else {
        // Silence detected
        if (this.silenceStartTime === null) {
          this.silenceStartTime = now;
        }
        
        // Check if silence duration exceeded
        const silenceDuration = now - this.silenceStartTime;
        const timeSinceLastProcess = now - this.lastProcessTime;
        
        // ✅ CRITICAL FIX: Check resume logic BEFORE checking if user spoke
        // Resume should trigger when user interrupts but doesn't speak (hasSpoken = false)
        // ✅ OPTIMIZATION: Throttle resume checks to 300ms interval (reduces CPU from 100% to 70%)
        if (this.hasInterrupted && this.interruptTime && !this.resumeAttempted && isFeatureEnabled('VOICE_STREAMING')) {
          const timeSinceLastCheck = now - this.lastResumeCheckTime;
          // ✅ OPTIMIZATION: Only check resume every 300ms (industry standard: 200-300ms)
          if (timeSinceLastCheck >= this.RESUME_CHECK_INTERVAL) {
            this.lastResumeCheckTime = now;
            const timeSinceInterrupt = now - this.interruptTime;
            const silenceAfterInterrupt = silenceDuration;
            
            // ✅ CRITICAL FIX: Resume if silence is long enough (user stopped speaking after interrupt)
            // This handles the case where user interrupts but doesn't actually want to speak
            if (silenceAfterInterrupt >= 1000 && timeSinceInterrupt < 10000) {
            logger.info(`[VoiceCall] ▶️ User stopped speaking after interrupt (${silenceAfterInterrupt}ms silence) - resuming Atlas response`);
            this.resumeAttempted = true; // ✅ CRITICAL: Mark as attempted to prevent spam
            audioQueueService.resume();
            this.hasInterrupted = false; // Reset interrupt flag
            this.interruptTime = null; // Reset interrupt time
            this.resumeAttempted = false; // Reset resume flag
            options.onStatusChange?.('speaking');
            // Reset VAD state
            this.silenceStartTime = null;
            this.lastSpeechTime = null;
            // Don't process speech - user was just interrupting, not speaking
            return;
            }
          }
        }
        
        // ⚡ Process after silence + speech + cooldown
        // ✅ FIX: Only process if speech actually occurred (lastSpeechTime was set)
        const hasSpoken = this.lastSpeechTime !== null;
        const speechDuration = hasSpoken ? now - this.lastSpeechTime : 0;
        const timeSinceRejection = now - this.lastRejectedTime;
        
        // ✅ FIX: Calculate recording duration to prevent premature processing
        const recordingDuration = now - this.recordingStartTime;
        
        if (
          hasSpoken && // ✅ CRITICAL: Only process if user actually spoke
          !this.isProcessing && // ✅ CRITICAL: Prevent concurrent processing (fixes double voice issue)
          recordingDuration >= this.MIN_RECORDING_DURATION && // ✅ FIX: Ensure recorder has time to collect chunks
          silenceDuration >= this.SILENCE_DURATION &&
          speechDuration >= this.MIN_SPEECH_DURATION &&
          timeSinceLastProcess >= this.MIN_PROCESS_INTERVAL &&
          timeSinceRejection >= this.REJECTION_COOLDOWN && // ✅ FIX: Prevent immediate retry after rejection
          this.mediaRecorder?.state === 'recording'
        ) {
          logger.debug('[VoiceCall] 🤫 Silence detected - processing speech');
          this.lastProcessTime = now; // Update cooldown timer
          this.mediaRecorder.stop(); // This triggers onstop handler which will process the chunk
          this.silenceStartTime = null; // Reset
          this.lastSpeechTime = null; // ✅ FIX: Reset after processing
          // ✅ CRITICAL: DON'T set isProcessing here - set it in onstop handler when chunk is ready
          // Setting it here causes race condition where onstop sees it and skips processing
          
          // ✅ FIX: If user spoke after interrupt but speech was very quick (<500ms), it might be interrupt tail
          // Check this here before processing
          if (this.hasInterrupted && this.interruptTime && isFeatureEnabled('VOICE_STREAMING')) {
            const timeSinceInterrupt = now - this.interruptTime;
            if (timeSinceInterrupt < 500) {
              // Speech happened very quickly after interrupt - likely just interrupt tail, resume Atlas
              logger.debug('[VoiceCall] Ignoring speech immediately after interrupt (<500ms) - resuming Atlas');
              audioQueueService.resume();
              this.hasInterrupted = false;
              this.interruptTime = null;
              this.silenceStartTime = null;
              this.lastSpeechTime = null;
              options.onStatusChange?.('speaking');
              return;
            }
          }
          
          // ✅ FIX: Don't reset interrupt flags here - wait until we know if it's real speech
          // Flags will be reset after successful processing or in error handlers
        }
      }
      } catch (error) {
        // ✅ FIX: Catch VAD errors to prevent silent failures
        logger.error('[VoiceCall] VAD check error:', error);
        // Don't end call - just log and continue
      }
    };
    
    // Check every 50ms for responsive VAD
    this.vadCheckInterval = setInterval(checkVAD, 50);
    logger.debug('[VoiceCall] ✅ VAD monitoring started');
  }
  
  /**
   * Helper: Check if recording is active
   */
  private isRecordingActive(): boolean {
    if (isFeatureEnabled('USE_VAD_SERVICE') && this.vadService) {
      return this.vadService.isRecording();
    }
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  /**
   * Helper: Stop recording if active
   */
  private stopRecordingIfActive(): void {
    if (isFeatureEnabled('USE_VAD_SERVICE') && this.vadService) {
      // VADService handles stopping internally via restart()
      return;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Helper: Create tracked timeout
   */
  private createTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    if (isFeatureEnabled('USE_TIMEOUT_MANAGEMENT_SERVICE') && this.timeoutManagementService) {
      return this.timeoutManagementService.setTimeout(callback, delay);
    }
    const timeout = setTimeout(() => {
      this.pendingTimeouts.delete(timeout);
      callback();
    }, delay);
    this.pendingTimeouts.add(timeout);
    return timeout;
  }

  /**
   * Helper: Clear tracked timeout
   */
  private clearTrackedTimeout(timeout: NodeJS.Timeout): void {
    if (isFeatureEnabled('USE_TIMEOUT_MANAGEMENT_SERVICE') && this.timeoutManagementService) {
      this.timeoutManagementService.clearTimeout(timeout);
    } else {
      clearTimeout(timeout);
      this.pendingTimeouts.delete(timeout);
    }
  }

  /**
   * Helper method to restart recording for next chunk
   * EXTRACTION_POINT: VADService
   * ✅ EXTRACTED: Uses VADService.restart() when feature flag enabled
   */
  private restartRecordingVAD(): void {
    if (isFeatureEnabled('USE_VAD_SERVICE') && this.vadService) {
      this.vadService.restart();
      return;
    }
    
    // Legacy implementation
    // ✅ CRITICAL FIX: Double-check isActive to prevent restarting after call ends
    if (!this.isActive) {
      logger.debug('[VoiceCall] Skipping restartRecordingVAD - call is not active');
      return;
    }
    
    if (!this.mediaRecorder) {
      logger.debug('[VoiceCall] Skipping restartRecordingVAD - mediaRecorder is null');
      return;
    }
    
    // ✅ FIX: Don't record while Atlas is speaking (check both standard AND streaming audio)
    const isAtlasSpeaking = 
      (isFeatureEnabled('USE_AUDIO_PLAYBACK_SERVICE') && this.audioPlaybackService?.isPlaying()) ||
      (!isFeatureEnabled('USE_AUDIO_PLAYBACK_SERVICE') && this.currentAudio && !this.currentAudio.paused) || 
      (isFeatureEnabled('VOICE_STREAMING') && audioQueueService.getIsPlaying());
    
    if (isAtlasSpeaking) {
      logger.debug('[VoiceCall] Skipping recording - Atlas is still speaking');
      this.createTimeout(() => {
        // ✅ CRITICAL: Check isActive again before restarting
        if (this.isActive) {
          this.restartRecordingVAD();
        }
      }, 500);
      return;
    }
    
    // ✅ FIX: Check if already recording before starting
    if (this.mediaRecorder.state === 'inactive') {
      // ✅ CRITICAL: Final check that call is still active
      if (!this.isActive) {
        logger.debug('[VoiceCall] Call ended while restarting - aborting');
        return;
      }
      
      // ✅ FIX: Reset VAD state when restarting for clean conversation flow
      this.silenceStartTime = null;
      this.lastSpeechTime = null;
      this.recordingStartTime = Date.now(); // Track when recording started
      
      try {
        this.mediaRecorder.start(100);
        logger.debug('[VoiceCall] 🎙️ Mic restarted - ready for next input');
      } catch (error) {
        logger.error('[VoiceCall] Error starting mediaRecorder:', error);
        // Don't restart if there's an error
      }
    }
  }
  
  /**
   * Process a single voice chunk: Route to streaming or standard mode
   * EXTRACTION_POINT: STTService, TTSService
   * TODO: Extract STT/TTS logic to respective services
   */
  private async processVoiceChunk(
    audioBlob: Blob,
    options: VoiceCallOptions
  ): Promise<void> {
    // ✅ CRITICAL FIX: Final mute check before processing (safety net)
    // Check both service mute state AND MediaStreamTrack state for maximum reliability
    const isMutedByService = this.isMuted;
    const isMutedByTrack = this.stream && this.stream.getAudioTracks().length > 0 
      ? !this.stream.getAudioTracks()[0].enabled 
      : false;
    
    if (isMutedByService || isMutedByTrack) {
      logger.debug(`[VoiceCall] Skipping audio processing - microphone is muted (service: ${isMutedByService}, track: ${isMutedByTrack})`);
      return;
    }
    
    // Route to streaming or standard based on feature flag
    if (isFeatureEnabled('VOICE_STREAMING')) {
      return this.processVoiceChunkStreaming(audioBlob, options);
    } else {
      return this.processVoiceChunkStandard(audioBlob, options);
    }
  }

  /**
   * Standard (non-streaming) voice processing
   * EXTRACTION_POINT: STTService, TTSService
   * TODO: Extract STT/TTS logic to respective services
   */
  private async processVoiceChunkStandard(
    audioBlob: Blob,
    options: VoiceCallOptions
  ): Promise<void> {
    try {
      // Update status: transcribing
      options.onStatusChange?.('transcribing');
      logger.debug('[VoiceCall] Processing voice chunk:', audioBlob.size, 'bytes');
      
      // 1. Convert audio blob to base64
      const base64Audio = await this.blobToBase64(audioBlob);
      
      // 2. Call STT Edge Function with retry logic
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const transcript = await this.retryWithBackoff(async () => {
        try {
        const sttResponse = await fetch(`${supabaseUrl}/functions/v1/stt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ audio: base64Audio.split(',')[1] }),
        });
        
        if (!sttResponse.ok) {
          const error = await sttResponse.json().catch(() => ({}));
          throw new Error(`STT failed: ${error.error || sttResponse.statusText}`);
        }
        
        const sttResult = await sttResponse.json();
        return sttResult.text;
        } catch (error) {
          // ✅ POLISH #3: Track errors
          this.callMetrics.errors++;
          throw error;
        }
      }, 'Speech Recognition');
      
      if (!transcript || transcript.trim().length === 0) {
        logger.debug('[VoiceCall] Empty transcript, skipping');
        return;
      }
      
      logger.info('[VoiceCall] 👤 User:', transcript);
      options.onTranscript(transcript);
      
      // Save user's voice message
      await this.saveVoiceMessage(transcript, 'user', options.conversationId, options.userId);
      
      // Update status: thinking
      options.onStatusChange?.('thinking');
      
      // 3. Send to Claude for response
      let aiResponse = await this.getAIResponse(transcript, options.conversationId);
      
      if (typeof aiResponse !== 'string') {
        aiResponse = JSON.stringify(aiResponse);
      }
      
      const logPreview = aiResponse.length > 100 ? aiResponse.substring(0, 100) + '...' : aiResponse;
      logger.info('[VoiceCall] 🤖 Atlas:', logPreview);
      options.onAIResponse(aiResponse);
      
      // Save Atlas's response
      await this.saveVoiceMessage(aiResponse, 'assistant', options.conversationId, options.userId);
      
      // Update status: speaking
      options.onStatusChange?.('speaking');
      
      // 4. Call TTS Edge Function
      // ✅ PRODUCTION-GRADE: Request ID tracking, enhanced error handling, fallback model
      const ttsResult = await this.retryWithBackoff(async () => {
        const requestId = crypto.randomUUID(); // ✅ Track requests for debugging
        let model = 'tts-1-hd'; // Start with HD model
        
        const ttsResponse = await fetch(`${supabaseUrl}/functions/v1/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'X-Request-ID': requestId, // ✅ Request tracking
          },
          body: JSON.stringify({ 
            text: aiResponse, 
            voice: 'nova',
            model: model,
            speed: 1.05, // 🎯 Natural conversation pace
          }),
        });
        
        if (!ttsResponse.ok) {
          let errorDetails: any;
          try {
            errorDetails = await ttsResponse.json();
          } catch {
            errorDetails = { error: ttsResponse.statusText };
          }
          
          // ✅ Fallback to standard model on timeout
          if (model === 'tts-1-hd' && (ttsResponse.status === 504 || errorDetails.error?.includes('timeout'))) {
            logger.warn(`[VoiceCall] HD model timeout, falling back to standard model`);
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
                text: aiResponse, 
                voice: 'nova',
                model: 'tts-1',
                speed: 1.05,
              }),
            });
            
            if (!fallbackResponse.ok) {
              const fallbackError = await fallbackResponse.json().catch(() => ({}));
              throw new Error(`TTS failed: ${fallbackError.details || fallbackError.error || fallbackResponse.statusText}`);
            }
            
            return await fallbackResponse.json();
          }
          
          // ✅ Enhanced error with details from server
          const errorMessage = errorDetails.details || errorDetails.error || ttsResponse.statusText;
          throw new Error(`TTS failed: ${errorMessage}`);
        }
        
        return await ttsResponse.json();
      }, 'Text-to-Speech');
      
      // 5. Play audio
      const audioDataUrl = `data:audio/mp3;base64,${ttsResult.base64Audio}`;
      
      if (isFeatureEnabled('USE_AUDIO_PLAYBACK_SERVICE')) {
        // Use extracted AudioPlaybackService
        if (!this.audioPlaybackService) {
          this.audioPlaybackService = new AudioPlaybackService();
        }
        
        await this.audioPlaybackService.play(audioDataUrl, {
          onPlay: () => logger.info('[VoiceCall] ✅ Audio playing'),
          onEnded: () => {
            options.onStatusChange?.('listening');
          },
          onError: (error) => {
            logger.error('[VoiceCall] Audio playback error:', error);
          },
        });
      } else {
        // Legacy implementation
        if (this.currentAudio && !this.currentAudio.paused) {
          this.currentAudio.pause();
          this.currentAudio.currentTime = 0;
          this.currentAudio = null;
        }
        
        const audio = new Audio(audioDataUrl);
        this.currentAudio = audio;
        
        (window as any).__atlasAudioElement = audio;
        
        audio.onloadeddata = () => logger.debug('[VoiceCall] Audio data loaded');
        audio.onplay = () => logger.info('[VoiceCall] ✅ Audio playing');
        audio.onerror = (e) => {
          logger.error('[VoiceCall] Audio error:', e);
          // ✅ FIX: Cleanup global state on error
          delete (window as any).__atlasAudioElement;
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
        };
        audio.onended = () => {
          logger.debug('[VoiceCall] Audio playback ended');
          options.onStatusChange?.('listening');
          delete (window as any).__atlasAudioElement;
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
        };
        
        await audio.play();
        logger.info('[VoiceCall] ✅ TTS audio played successfully');
      }
      
    } catch (error) {
      logger.error('[VoiceCall] Chunk processing error:', error);
      
      // ✅ POLISH #3: Track errors
      this.callMetrics.errors++;
      
      // ✅ FIX: Cleanup global state on error
      if (isFeatureEnabled('USE_AUDIO_PLAYBACK_SERVICE') && this.audioPlaybackService) {
        this.audioPlaybackService.stop();
      } else {
        // Legacy cleanup
        if ((window as any).__atlasAudioElement) {
          delete (window as any).__atlasAudioElement;
        }
        if (this.currentAudio) {
          this.currentAudio = null;
        }
      }
    }
  }
  
  /**
   * Streaming voice processing: STT → Claude Stream → Progressive TTS
   * EXTRACTION_POINT: STTService, TTSService
   * TODO: Extract STT/TTS logic to respective services
   */
  private async processVoiceChunkStreaming(
    audioBlob: Blob,
    options: VoiceCallOptions
  ): Promise<void> {
    const startTime = performance.now(); // ⏱️ Start latency tracking
    const sttStart = performance.now(); // ⏱️ STT latency tracking (must be before try block for scope)
    let transcript: string | null = null; // Declare transcript here for scope
    let session: any = null; // Declare session here for scope (used in Claude API call)
    
    try {
      options.onStatusChange?.('transcribing');
      const { data: { session: authSession } } = await supabase.auth.getSession();
      session = authSession; // Assign to outer scope variable
      
      // 1. STT - Call OpenAI Whisper directly (bypassing Supabase Edge Function)
      logger.info(`[VoiceCall] ⏱️ Audio blob size: ${(audioBlob.size / 1024).toFixed(1)}KB`);
      
      // ✅ OPTIMIZATION: Increased threshold from 5KB to 8KB (industry standard) to reduce false silence triggers
      if (audioBlob.size < 8 * 1024) {
        logger.debug(`[VoiceCall] ⚠️ Audio too small (${(audioBlob.size / 1024).toFixed(1)}KB < 8KB), skipping - likely silence`);
        this.lastRejectedTime = performance.now(); // ✅ FIX: Track rejection time
        this.lastSpeechTime = null; // ✅ FIX: Reset speech tracking
        this.silenceStartTime = null; // ✅ FIX: Reset silence tracking
        this.isProcessing = false; // ✅ CRITICAL: Clear processing flag
        // Don't restart immediately - let VAD handle it naturally after cooldown
        this.createTimeout(() => {
          if (this.isActive) {
            this.restartRecordingVAD();
          }
        }, this.REJECTION_COOLDOWN);
        return;
      }
      
      // ✅ CRITICAL FIX: Check confidence BEFORE retry logic - fail fast for 0.0%
      // This prevents wasting 26+ seconds retrying silence/noise
      transcript = await (async () => {
        if (isFeatureEnabled('USE_STT_SERVICE')) {
          // Use extracted STTService
          if (!this.sttService) {
            this.sttService = new STTService({
              timeout: this.getSTTTimeout(audioBlob.size),
            });
          }
          return await this.sttService.transcribe(audioBlob, {
            onTranscribed: (text, confidence) => {
              logger.info(`[VoiceCall] ⏱️ STT: ${text.length} chars, ${(confidence * 100).toFixed(1)}% confidence`);
            },
            onError: (error) => {
              logger.error('[VoiceCall] STT error:', error);
            },
          });
        }
        
        // Legacy implementation
        // Convert audio blob to base64 for Deepgram
        const base64Audio = await this.blobToBase64(audioBlob);
        const { data: { session } } = await supabase.auth.getSession();
        
        const fetchStart = performance.now();
        
        // ✅ IMPROVEMENT: Adaptive timeout based on network quality
        const controller = new AbortController();
        const timeoutTimeout = this.createTimeout(() => controller.abort(), this.getSTTTimeout(audioBlob.size));
        
        try {
          // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
          const sttResponse = await fetch(getApiEndpoint('/api/stt-deepgram'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ 
              audio: base64Audio.split(',')[1] // Remove data:audio/webm;codecs=opus, prefix
            }),
            signal: controller.signal,
          });
          if (isFeatureEnabled('USE_TIMEOUT_MANAGEMENT_SERVICE') && this.timeoutManagementService) {
            this.timeoutManagementService.clearTimeout(timeoutTimeout);
          } else {
            clearTimeout(timeoutTimeout);
            this.pendingTimeouts.delete(timeoutTimeout);
          }
          
          logger.info(`[VoiceCall] ⏱️ STT fetch: ${(performance.now() - fetchStart).toFixed(0)}ms`);
          
          if (!sttResponse.ok) {
            const error = await sttResponse.text();
            throw new Error(`STT failed: ${error}`);
          }
          
          const result = await sttResponse.json();
          const confidence = result.confidence || 0;
          const text = result.text || '';
          
          logger.info(`[VoiceCall] 📊 Deepgram confidence: ${(confidence * 100).toFixed(1)}%`);
          
          // ✅ CRITICAL FIX: Reject low confidence results to prevent processing silence/noise/cough/sneeze
          // ✅ IMPROVEMENT: ChatGPT uses 0.2 (20%) threshold - below this is likely noise
          // Cough/sneeze typically get 0-10% confidence, background noise gets 0-5%
          if (confidence < 0.2) {
            const confidencePercent = (confidence * 100).toFixed(1);
            const noiseType = confidence === 0 ? 'silence' : confidence < 0.05 ? 'background noise' : confidence < 0.1 ? 'cough/sneeze' : 'unclear audio';
            logger.warn(`[VoiceCall] ❌ Very low confidence (${confidencePercent}%) - rejecting as ${noiseType}`);
            logger.debug(`[VoiceCall] Debug - Format: ${this.recordingMimeType}, Size: ${(audioBlob.size / 1024).toFixed(1)}KB`);
            
            // ✅ CRITICAL: For 0.0% confidence, throw immediately - don't retry
            if (confidence === 0 || confidencePercent === '0.0') {
              logger.debug('[VoiceCall] ⚡ 0.0% confidence - failing fast (no retries)');
              throw new Error(`STT confidence too low (0.0%) - likely silence or noise`);
            }
            
            throw new Error(`STT confidence too low (${confidencePercent}%) - likely silence or noise`);
          }
          
          // ✅ FIX: Also reject empty or very short transcripts (likely noise)
          if (!text || text.trim().length < 2) {
            logger.debug('[VoiceCall] ❌ Empty or too short transcript - rejecting');
            throw new Error('Transcript too short - likely noise');
          }
          
          // Log warning for medium-low confidence but still process
          if (confidence < 0.5) {
            logger.warn(`[VoiceCall] ⚠️ Low confidence (${(confidence * 100).toFixed(1)}%). Audio may be unclear.`);
            logger.debug(`[VoiceCall] Debug - Format: ${this.recordingMimeType}, Size: ${(audioBlob.size / 1024).toFixed(1)}KB`);
          }
          
          return text;
        } catch (error) {
          // ✅ POLISH #3: Track errors
          this.callMetrics.errors++;
          
          if (isFeatureEnabled('USE_TIMEOUT_MANAGEMENT_SERVICE') && this.timeoutManagementService) {
            this.timeoutManagementService.clearTimeout(timeoutTimeout);
          } else {
            clearTimeout(timeoutTimeout);
            this.pendingTimeouts.delete(timeoutTimeout);
          }
          if (error.name === 'AbortError') {
            throw new Error('STT timeout - server took too long to respond');
          }
          throw error;
        }
      })();
      
      // ✅ CRITICAL: If we got here, transcript is valid (confidence >= 0.2)
      // Continue processing with valid transcript below
      
    } catch (error: any) {
      // ✅ POLISH #3: Track errors (if not already tracked above)
      if (!error.message?.includes('confidence too low')) {
        this.callMetrics.errors++;
        // Track STT errors to Sentry
        captureException(error, {
          feature: 'voice_call',
          error_type: 'stt_error',
          latency: performance.now() - sttStart
        });
      }
      
      // ✅ CRITICAL FIX: For 0.0% confidence, check resume logic BEFORE failing fast
      // If Atlas was interrupted and audio was rejected, resume Atlas instead of failing
      if (error.message?.includes('confidence too low') && 
          (error.message?.includes('0.0%') || error.message?.includes('0.0'))) {
        logger.debug('[VoiceCall] ⚡ 0.0% confidence detected - checking if Atlas should resume');
        
        // ✅ CRITICAL FIX: Check resume logic BEFORE failing fast
        // If Atlas was interrupted and audio was rejected (cough/sneeze/noise), resume Atlas
        if (this.hasInterrupted && this.interruptTime && isFeatureEnabled('VOICE_STREAMING')) {
          const timeSinceInterrupt = Date.now() - this.interruptTime;
          logger.debug(`[VoiceCall] 🔍 Resume check after 0.0% rejection - hasInterrupted: ${this.hasInterrupted}, timeSinceInterrupt: ${timeSinceInterrupt}ms`);
          
          // ✅ FIX: Resume if interrupt was recent (< 5 seconds)
          if (timeSinceInterrupt < 5000) {
            logger.info('[VoiceCall] ▶️ 0.0% confidence after interrupt - resuming Atlas (likely cough/sneeze/noise)');
            audioQueueService.resume();
            this.hasInterrupted = false;
            this.interruptTime = null;
            options.onStatusChange?.('speaking');
            
            // Reset VAD state and restart mic
            this.lastRejectedTime = Date.now();
            this.lastSpeechTime = null;
            this.silenceStartTime = null;
            this.isProcessing = false; // ✅ CRITICAL: Clear processing flag
            this.createTimeout(() => {
              if (this.isActive) {
                this.restartRecordingVAD();
              }
            }, this.REJECTION_COOLDOWN);
            return; // Return early - resume handled it
          }
        }
        
        // If resume didn't trigger, fail fast (no retries)
        logger.debug('[VoiceCall] ⚡ 0.0% confidence - failing fast (no retries)');
        this.lastRejectedTime = Date.now();
        this.lastSpeechTime = null;
        this.silenceStartTime = null;
        this.isProcessing = false; // ✅ CRITICAL: Clear processing flag
        this.createTimeout(() => {
          if (this.isActive) {
            this.restartRecordingVAD();
          }
        }, this.REJECTION_COOLDOWN);
        return; // Return early to indicate rejection
      }
      
      // ✅ For other errors (network, etc.), use retry logic
      transcript = await this.retryWithBackoff(async () => {
        // Retry the STT call for network errors only
        const base64Audio = await this.blobToBase64(audioBlob);
        const { data: { session } } = await supabase.auth.getSession();
        const controller = new AbortController();
        const timeout = this.createTimeout(() => controller.abort(), this.getSTTTimeout(audioBlob.size));
        
        try {
          // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
          const sttResponse = await fetch(getApiEndpoint('/api/stt-deepgram'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ 
              audio: base64Audio.split(',')[1]
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          this.pendingTimeouts.delete(timeout); // ✅ FIX: Remove from tracking when cleared
      
          if (!sttResponse.ok) {
            const error = await sttResponse.text();
            throw new Error(`STT failed: ${error}`);
          }
          
          const result = await sttResponse.json();
          const confidence = result.confidence || 0;
          const text = result.text || '';
          
          if (confidence < 0.2) {
            const confidencePercent = (confidence * 100).toFixed(1);
            throw new Error(`STT confidence too low (${confidencePercent}%) - likely silence or noise`);
          }
          
          if (!text || text.trim().length < 2) {
            throw new Error('Transcript too short - likely noise');
          }
          
          return text;
        } catch (err) {
          clearTimeout(timeout);
          this.pendingTimeouts.delete(timeout); // ✅ FIX: Remove from tracking when cleared
          if (err.name === 'AbortError') {
            throw new Error('STT timeout - server took too long to respond');
          }
          throw err;
        }
      }, 'Speech Recognition').catch((error) => {
        // ✅ CRITICAL FIX: Handle STT errors gracefully - reject low confidence/empty results
        if (error.message.includes('confidence too low') || error.message.includes('too short')) {
          logger.debug(`[VoiceCall] STT rejected: ${error.message} - checking if Atlas should resume`);
          
          // ✅ DEBUG: Log interrupt state for troubleshooting
          logger.debug(`[VoiceCall] 🔍 Resume check - hasInterrupted: ${this.hasInterrupted}, interruptTime: ${this.interruptTime}, VOICE_STREAMING: ${isFeatureEnabled('VOICE_STREAMING')}`);
          
          // ✅ CRITICAL FIX: If Atlas was interrupted and audio was rejected (cough/sneeze/noise),
          // resume Atlas's response - user didn't actually speak
          if (this.hasInterrupted && this.interruptTime && isFeatureEnabled('VOICE_STREAMING')) {
            const timeSinceInterrupt = Date.now() - this.interruptTime;
            logger.debug(`[VoiceCall] 🔍 Time since interrupt: ${timeSinceInterrupt}ms`);
            // ✅ FIX: Increase window to 5 seconds for retry scenarios (was 2s)
            // After retries, time can exceed 2s but still be an interrupt-related rejection
            if (timeSinceInterrupt < 5000) {
              logger.info('[VoiceCall] ▶️ Audio rejected after interrupt - resuming Atlas (likely cough/sneeze/noise)');
              audioQueueService.resume();
              this.hasInterrupted = false;
              this.interruptTime = null;
              options.onStatusChange?.('speaking');
              // ✅ CRITICAL: Return null and restart mic - don't throw error
              this.lastRejectedTime = Date.now();
              this.lastSpeechTime = null;
              this.silenceStartTime = null;
              this.isProcessing = false; // ✅ CRITICAL: Clear processing flag
              this.createTimeout(() => {
                if (this.isActive) {
                  this.restartRecordingVAD();
                }
              }, this.REJECTION_COOLDOWN);
              return null;
            } else {
              logger.debug(`[VoiceCall] ⏱️ Too long since interrupt (${timeSinceInterrupt}ms > 5000ms) - not resuming`);
            }
          } else {
            logger.debug('[VoiceCall] ⚠️ Resume conditions not met - hasInterrupted or interruptTime missing');
          }
          
          this.lastRejectedTime = Date.now();
          this.lastSpeechTime = null;
          this.silenceStartTime = null;
          this.createTimeout(() => {
            if (this.isActive) {
              this.restartRecordingVAD();
            }
          }, this.REJECTION_COOLDOWN);
          return null; // Return null to indicate rejection
        }
        throw error; // Re-throw other errors
      });
      
      // ✅ FIX: If retry succeeded but transcript was rejected (null), return early
      if (!transcript || !transcript.trim()) {
        logger.debug('[VoiceCall] Transcript rejected after retry - restarting mic');
        this.restartRecordingVAD();
        return;
      }
      
      // If retry succeeded, fall through to continue processing below
    }
    
    // ✅ CRITICAL: If we got here, transcript is valid (confidence >= 0.2)
    // This code runs whether transcript came from first attempt or retry
      const sttLatency = performance.now() - sttStart;
      logger.info(`[VoiceCall] ⏱️ STT: ${sttLatency.toFixed(0)}ms`);
      
      // ✅ POLISH #3: Track STT latency
      this.callMetrics.sttLatencies.push(sttLatency);
      logger.info('[VoiceCall] 👤 User:', transcript);
    
      // ✅ FIX: Reject very short transcripts (< 2 chars) - likely noise
      if (transcript.trim().length < 2) {
        logger.debug(`[VoiceCall] Transcript too short (${transcript.trim().length} chars), rejecting as noise`);
        this.lastRejectedTime = Date.now();
        this.lastSpeechTime = null;
        this.silenceStartTime = null;
        this.isProcessing = false; // ✅ CRITICAL: Clear processing flag
        this.createTimeout(() => {
          logger.debug('[VoiceCall] 🔄 Restarting mic after short transcript rejection');
          this.restartRecordingVAD();
        }, this.REJECTION_COOLDOWN);
        return;
      }
    
    // ✅ CRITICAL FIX: Reset interrupt flags AFTER we successfully processed real speech
    // This ensures resume logic can trigger if processing fails (cough/sneeze/noise)
    this.hasInterrupted = false;
    this.interruptTime = null;
    this.interruptStartTime = null; // ✅ PHASE 2: Reset overlap/yield tracking
    this.isProcessing = false; // ✅ CRITICAL: Clear processing flag after successful processing
      
      // Add user message to conversational buffer
      conversationBuffer.add('user', transcript);
      
      options.onTranscript(transcript);
      await this.saveVoiceMessage(transcript, 'user', options.conversationId, options.userId);
      
      options.onStatusChange?.('thinking');
      
      // ✅ PHASE 2: Acknowledgment sound moved to TTFB (immediate feedback)
      // (Played when Claude TTFB completes, not here)
      
      // 2. Claude Streaming with timeout
      // ✅ FIX: 25s timeout for voice calls - buffer for mobile + streaming processing
      // Voice calls need reasonable timeouts to avoid false failures
      const claudeStart = performance.now();
      const claudeController = new AbortController();
      const claudeTimeout = this.createTimeout(() => claudeController.abort(), 25000); // ✅ FIX: 25s timeout (was 20s) - buffer for mobile + streaming processing
      
      // ✅ CRITICAL FIX: Ensure session is available for Claude API call
      if (!session) {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        session = authSession;
      }
      
      let response;
      try {
        // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
        response = await fetch(getApiEndpoint('/api/message?stream=1'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            message: transcript,
            conversationId: options.conversationId,
            is_voice_call: true,
            // ✅ FIX: Don't send context - let backend load full conversation history from database
            // Frontend buffer only has current session, backend loads last 10 messages for proper memory
          }),
          signal: claudeController.signal,
        });
        this.clearTrackedTimeout(claudeTimeout);
      } catch (error) {
        this.clearTrackedTimeout(claudeTimeout);
        
        // ✅ POLISH #3: Track errors
        this.callMetrics.errors++;
        
        if (error.name === 'AbortError') {
          logger.error('[VoiceCall] Claude timeout - took too long to respond');
          const timeoutError = new Error('Atlas took too long to respond. Please try again.');
          captureException(timeoutError, {
            feature: 'voice_call',
            error_type: 'claude_timeout',
            latency: performance.now() - claudeStart
          });
          options.onError(timeoutError);
        } else {
          logger.error('[VoiceCall] Claude connection error:', error);
          captureException(error as Error, {
            feature: 'voice_call',
            error_type: 'claude_connection',
            latency: performance.now() - claudeStart
          });
          options.onError(error as Error);
        }
        return;
      }
      
      if (!response.ok) {
        // ✅ POLISH #3: Track errors
        this.callMetrics.errors++;
        
        const error = new Error(`Claude streaming failed: ${response.statusText}`);
        logger.error(`[VoiceCall] Claude streaming failed: ${response.statusText}`);
        captureException(error, {
          feature: 'voice_call',
          error_type: 'claude_streaming_failed',
          status: response.status,
          statusText: response.statusText,
          latency: performance.now() - claudeStart
        });
        options.onError(error);
        return;
      }
      
      const claudeConnectTime = performance.now() - claudeStart;
      logger.info(`[VoiceCall] ⏱️ Claude connect (TTFB): ${claudeConnectTime.toFixed(0)}ms`);
      
      // ✅ POLISH #3: Track Claude TTFB latency
      this.callMetrics.claudeLatencies.push(claudeConnectTime);
      
      // ✅ PHASE 2: Play acknowledgment sound when Claude starts thinking (TTFB)
      // This gives immediate feedback that Atlas is processing
      this.playAcknowledgmentSound();
      
      // 3. Parse SSE stream
      const streamingStart = performance.now();
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let sentenceIndex = 0;
      let currentSentence = '';
      
      audioQueueService.reset(); // Clear queue for new response
      options.onStatusChange?.('speaking');
    
    // ✅ CRITICAL FIX: Stop recording immediately when Atlas starts speaking
    // This prevents microphone from picking up Atlas's own voice output (feedback loop)
    if (this.isRecordingActive()) {
      logger.debug('[VoiceCall] 🛑 Stopping recording - Atlas starting to speak (prevent feedback)');
      this.stopRecordingIfActive();
    }
    
    // ✅ FIX: Set callback to update status when audio completes
    audioQueueService.setOnComplete(() => {
      logger.info('[VoiceCall] ✅ All audio playback completed');
      options.onStatusChange?.('listening');
      
      // ✅ CRITICAL FIX: Don't reset interrupt flags here if Atlas was interrupted
      // Flags should only be reset after successful speech processing or after resume
      // If we reset here, resume logic can't trigger when errors occur
      // This allows resume logic to work even if audio queue completes after interrupt
      if (!this.hasInterrupted) {
        // Only reset if there was no interrupt (normal completion)
        this.hasInterrupted = false;
        this.interruptTime = null;
      } else {
        logger.debug('[VoiceCall] 🔍 Audio completed but interrupt flags preserved for resume check');
      }
      
      // ✅ CRITICAL FIX: Ensure recorder is stopped before restarting
      // Prevents any lingering recording from picking up Atlas's voice
      if (this.isRecordingActive()) {
        logger.debug('[VoiceCall] 🛑 Stopping recorder before restart (safety check)');
        this.stopRecordingIfActive();
      }
      
      // ✅ FIX: Small delay before restarting to ensure audio queue is fully cleared
      const timeout = setTimeout(() => {
        this.pendingTimeouts.delete(timeout);
        // ✅ CRITICAL: Check isActive before restarting (call might have ended)
        if (this.isActive) {
          this.restartRecordingVAD(); // Restart mic for next input
        }
      }, 200); // ✅ FIX: Increased delay to ensure recorder fully stops
      this.pendingTimeouts.add(timeout);
    });
      
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                // ✅ CRITICAL FIX: Filter stage directions from chunk immediately
                // DO NOT trim here - preserves whitespace between chunks
                // Handle both asterisks (*stage direction*) and square brackets ([stage direction])
                const filteredChunk = data.chunk
                  .replace(/\*[^*]+\*/g, '') // Remove asterisk stage directions
                  .replace(/\[[^\]]+\]/g, '') // Remove square bracket stage directions
                  .replace(/\s+/g, ' ');
                fullResponse += filteredChunk;
                currentSentence += filteredChunk;
                
              // ✅ FIX: ChatGPT-like streaming - speak on partial sentences for lower latency
              // Don't wait for full punctuation - start speaking after reasonable chunks
              const MIN_SENTENCE_LENGTH = 15; // Minimum chars before speaking (ChatGPT-like)
              const MAX_WAIT_LENGTH = 100; // Max chars to wait before forcing speech
              
              // Check if we have enough text to start speaking
              if (currentSentence.length >= MIN_SENTENCE_LENGTH) {
                // Try to split on punctuation first
                const sentencePattern = /([.!?]+)\s+/g;
                const parts = currentSentence.split(sentencePattern);
                
                // Process complete sentences (punctuation + space pairs)
                for (let i = 0; i < parts.length - 1; i += 2) {
                  const sentence = (parts[i] || '') + (parts[i + 1] || '');
                  const cleanSentence = sentence
                    .replace(/\*[^*]+\*/g, '') // ✅ FIX: Remove stage directions (e.g., "*speaks in a friendly voice*")
                    .replace(/\[[^\]]+\]/g, '') // ✅ FIX: Remove square bracket stage directions (e.g., "[In a clear voice]")
                    .replace(/\n+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                  
                  if (cleanSentence.length > 3) {
                    // ✅ FIX: Don't await - add sentence and continue (non-blocking)
                    audioQueueService.addSentence(cleanSentence, sentenceIndex++, 'nova');
                    options.onAIResponse(fullResponse);
                  }
                }
                
                // Keep remaining text
                currentSentence = parts.length % 2 === 1 ? parts[parts.length - 1] : '';
                
                // ✅ FIX: If we're accumulating too much text without punctuation, force speech
                // This prevents long delays waiting for punctuation (ChatGPT does this)
                if (currentSentence.length >= MAX_WAIT_LENGTH) {
                  const cleanSentence = currentSentence
                    .replace(/\*[^*]+\*/g, '') // ✅ FIX: Remove stage directions (e.g., "*speaks in a friendly voice*")
                    .replace(/\[[^\]]+\]/g, '') // ✅ FIX: Remove square bracket stage directions (e.g., "[In a clear voice]")
                    .replace(/\n+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                  
                  if (cleanSentence.length > 3) {
                    audioQueueService.addSentence(cleanSentence, sentenceIndex++, 'nova');
                    options.onAIResponse(fullResponse);
                    currentSentence = ''; // Reset after forcing speech
                  }
                }
              }
              }
            } catch (e) {
              // Ignore parse errors for keep-alive messages
            }
          }
        }
      }
      
    // ✅ FIX: Process remaining text (even if not ending with punctuation)
    // This ensures nothing is cut off - ChatGPT plays incomplete sentences too
    if (currentSentence.trim().length > 0) {
      // ✅ FIX: Clean final sentence - remove extra newlines and whitespace
      const cleanFinalSentence = currentSentence
        .replace(/\*[^*]+\*/g, '') // ✅ FIX: Remove stage directions (e.g., "*speaks in a friendly voice*")
        .replace(/\[[^\]]+\]/g, '') // ✅ FIX: Remove square bracket stage directions (e.g., "[In a clear voice]")
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();
      
      if (cleanFinalSentence.length > 0) {
        await audioQueueService.addSentence(cleanFinalSentence, sentenceIndex++, 'nova');
        logger.debug(`[VoiceCall] Added final sentence: "${cleanFinalSentence.substring(0, 50)}..."`);
      }
      }
      
      // ✅ REMOVED DUPLICATE: Backend /api/message already saves the assistant response
      // No need to save again here - prevents duplicate messages in UI
      // await this.saveVoiceMessage(fullResponse, 'assistant', options.conversationId, options.userId);
      
      // Add assistant response to conversational buffer
      conversationBuffer.add('assistant', fullResponse);
      
      // ⏱️ Log performance breakdown
      const streamingTime = performance.now() - streamingStart;
      const totalLatency = performance.now() - startTime;
      logger.info(`[VoiceCall] ⏱️ Claude streaming: ${streamingTime.toFixed(0)}ms`);
      logger.info(`[VoiceCall] ⏱️ Total latency: ${totalLatency.toFixed(0)}ms`);
      logger.info(`[VoiceCall] 🤖 Atlas (streaming complete):`, fullResponse.substring(0, 100) + '...');
      
    } catch (error) {
      logger.error('[VoiceCall] processVoiceChunkStreaming error:', error);
    
    // ✅ CRITICAL FIX: If Atlas was interrupted and processing failed (likely rejected audio),
    // resume Atlas's response - user didn't actually speak (cough/sneeze/noise)
    // ✅ DEBUG: Log interrupt state for troubleshooting
    logger.debug(`[VoiceCall] 🔍 Resume check - hasInterrupted: ${this.hasInterrupted}, interruptTime: ${this.interruptTime}, VOICE_STREAMING: ${isFeatureEnabled('VOICE_STREAMING')}`);
    
    if (this.hasInterrupted && this.interruptTime && isFeatureEnabled('VOICE_STREAMING')) {
      const timeSinceInterrupt = Date.now() - this.interruptTime;
      logger.debug(`[VoiceCall] 🔍 Time since interrupt: ${timeSinceInterrupt}ms`);
      // ✅ FIX: Increase window to 5 seconds for retry scenarios (was 2s)
      // After retries, time can exceed 2s but still be an interrupt-related rejection
      if (timeSinceInterrupt < 5000) {
        logger.info('[VoiceCall] ▶️ Processing error after interrupt - resuming Atlas (likely rejected cough/sneeze/noise)');
        audioQueueService.resume();
        this.hasInterrupted = false;
        this.interruptTime = null;
        options.onStatusChange?.('speaking');
        // Don't call onError - resume handled it
        return;
      } else {
        logger.debug(`[VoiceCall] ⏱️ Too long since interrupt (${timeSinceInterrupt}ms > 5000ms) - not resuming`);
    }
    } else {
      logger.debug('[VoiceCall] ⚠️ Resume conditions not met - hasInterrupted or interruptTime missing');
    }
    
    // ✅ CRITICAL FIX: Always restart mic after errors to ensure conversation continues
    // Even if STT fails, we want to keep listening for the next input
    logger.info('[VoiceCall] 🔄 Restarting mic after processing error to continue conversation');
    this.isProcessing = false; // ✅ CRITICAL: Clear processing flag on error
    this.restartRecordingVAD();
    
    // Only call onError if we didn't resume
    options.onError(error as Error);
  }
  
  // EXTRACTION_POINT: STTService
  // TODO: Extract to STTService.encodeAudio()
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  // EXTRACTION_POINT: RetryService
  // ✅ EXTRACTED: RetryService.withBackoff() (with feature flag fallback)
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    operation: string
  ): Promise<T> {
    if (isFeatureEnabled('USE_RETRY_SERVICE')) {
      // Use extracted RetryService
      if (!this.retryService) {
        this.retryService = new RetryService({
          maxRetries: this.MAX_RETRIES,
          retryDelays: this.RETRY_DELAYS,
        });
      }
      
      return this.retryService.withBackoff(fn, operation, {
        onRetry: (attempt) => {
          this.currentOptions?.onStatusChange?.('transcribing');
        },
      });
    }
    
    // Legacy implementation
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          this.currentOptions?.onStatusChange?.('transcribing');
          logger.info(`[VoiceCall] Retry attempt ${attempt + 1}/${this.MAX_RETRIES} for ${operation}`);
          
          // ✅ IMPROVEMENT: Add jitter to prevent thundering herd problem
          const baseDelay = this.RETRY_DELAYS[attempt - 1] || 10000;
          const jitter = Math.random() * 0.3 * baseDelay; // ±30% jitter
          const delay = baseDelay + jitter;
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        return await fn();
      } catch (error: unknown) {
        lastError = error as Error;
        
        // Don't retry auth errors or rate limits
        if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('429')) {
          throw error;
        }
        
        // ✅ CRITICAL FIX: Don't retry 0.0% confidence errors - it's wasted time
        // 0.0% confidence means silence/noise, retrying won't help
        if (error.message?.includes('confidence too low') && error.message?.includes('0.0%')) {
          logger.debug('[VoiceCall] ⚡ Skipping retries for 0.0% confidence (silence/noise)');
          throw lastError; // Fail fast - no retries
        }
        
        if (attempt === this.MAX_RETRIES - 1) {
          // ✅ CRITICAL FIX: Preserve original error message for low confidence/empty transcript
          // This allows resume logic to work after retries fail
          if (lastError?.message?.includes('confidence too low') || lastError?.message?.includes('too short')) {
            throw lastError; // Preserve original error for resume logic
          }
          throw new Error(`Connection lost. Please check your internet connection.`);
        }
      }
    }
    
    throw lastError || new Error(`${operation} failed`);
  }
  
  // EXTRACTION_POINT: TTSService (part of streaming flow)
  // TODO: This is part of TTS service in standard mode
  private async getAIResponse(userMessage: string, conversationId: string): Promise<string> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }
      
      // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
      const response = await fetch(getApiEndpoint('/api/message?stream=1'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId: conversationId,
          is_voice_call: true,
          // ✅ FIX: Don't send context - let backend load full conversation history from database
        })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Backend error: ${response.status}`);
      }
      
      // ✅ CRITICAL FIX: Parse SSE stream correctly (not JSON)
      // SSE format: "data: {...}\n\n" - need to extract and parse data lines
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';
      
      if (!reader) {
        throw new Error('Response body is not readable');
      }
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6); // Remove "data: " prefix
              if (jsonStr.trim() === '[DONE]') continue;
              const data = JSON.parse(jsonStr);
              
              // Extract text from SSE data (backend sends { chunk: "text" } format)
              if (data.chunk) {
                fullResponse += data.chunk;
              } else if (data.type === 'content_block_delta' && data.delta?.text) {
                // Alternative format from Anthropic
                fullResponse += data.delta.text;
              } else if (data.type === 'message_stop' || data.type === 'message_end') {
                // Stream complete
                break;
              } else if (data.error) {
                throw new Error(data.error.message || 'AI response error');
              }
            } catch (e) {
              // Skip malformed lines, continue parsing
              logger.debug('[VoiceCall] Skipping malformed SSE line:', line);
            }
          }
        }
      }
      
      // Decode remaining buffer
      if (buffer) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              if (jsonStr.trim() === '[DONE]') continue;
              const data = JSON.parse(jsonStr);
              if (data.chunk) {
                fullResponse += data.chunk;
              } else if (data.type === 'content_block_delta' && data.delta?.text) {
                fullResponse += data.delta.text;
              }
            } catch (e) {
              // Skip malformed lines
            }
          }
        }
      }
      
      if (!fullResponse) {
        throw new Error('No response received from AI');
      }
      
      return fullResponse;
    } catch (error) {
      logger.error('[VoiceCall] AI response error:', error);
      return 'I apologize, I encountered an error. Please try again.';
    }
  }
  
  // EXTRACTION_POINT: MessagePersistenceService
  // ✅ EXTRACTED: MessagePersistenceService (with feature flag fallback)
  private messagePersistenceService?: MessagePersistenceService;
  
  private async trackCallMetering(userId: string, durationSeconds: number): Promise<void> {
    if (isFeatureEnabled('USE_MESSAGE_PERSISTENCE_SERVICE')) {
      // Use extracted MessagePersistenceService
      if (!this.messagePersistenceService) {
        this.messagePersistenceService = new MessagePersistenceService();
      }
      
      try {
        await this.messagePersistenceService.trackCallMetering(
          userId,
          durationSeconds,
          this.currentOptions?.tier || 'unknown'
        );
      } catch (error) {
        // Non-critical - log but don't throw
        logger.error('[VoiceCall] Metering failed:', error);
      }
      return;
    }
    
    // Legacy implementation
    try {
      const sttCost = (durationSeconds / 60) * 0.006;
      const estimatedTTSChars = durationSeconds * 25;
      const ttsCost = (estimatedTTSChars / 1000) * 0.015;
      const totalCost = sttCost + ttsCost;
      
      const { error } = await supabase.from('usage_logs').insert({
        user_id: userId,
        event: 'voice_call_completed',
        data: {
          feature: 'voice_call',
          tier: this.currentOptions?.tier || 'unknown',
          duration_seconds: durationSeconds,
          tokens_used: 0,
          estimated_cost: totalCost,
          cost_breakdown: { stt: sttCost, tts: ttsCost, total: totalCost }
        },
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
      
      if (!error) {
        logger.info('[VoiceCall] ✅ Usage logged successfully');
      }
    } catch (error) {
      logger.error('[VoiceCall] Metering failed:', error);
    }
  }
  
  // EXTRACTION_POINT: MessagePersistenceService
  // ✅ EXTRACTED: MessagePersistenceService.save() (with feature flag fallback)
  private async saveVoiceMessage(
    text: string,
    role: 'user' | 'assistant',
    conversationId: string,
    userId: string
  ): Promise<void> {
    // ✅ CRITICAL FIX: Filter stage directions before saving (frontend save path)
    const filterResponse = (text: string): string => {
      if (!text) return text;
      let filtered = text;
      filtered = filtered.replace(/\*[^*]+\*/g, ''); // Remove asterisk stage directions
      filtered = filtered.replace(/\[[^\]]+\]/g, ''); // Remove square bracket stage directions
      filtered = filtered.replace(/\s{2,}/g, ' '); // Collapse multiple spaces
      return filtered.trim();
    };
    
    const filteredText = role === 'assistant' ? filterResponse(text) : text;
    
    if (isFeatureEnabled('USE_MESSAGE_PERSISTENCE_SERVICE')) {
      // Use extracted MessagePersistenceService
      if (!this.messagePersistenceService) {
        this.messagePersistenceService = new MessagePersistenceService();
      }
      
      try {
        await this.messagePersistenceService.saveMessage(filteredText, role, conversationId, userId);
      } catch (error) {
        // Non-critical - log but don't throw
        logger.error('[VoiceCall] Error saving message:', error);
      }
      return;
    }
    
    // Legacy implementation
    try {
      const messageData = {
        conversation_id: conversationId,
        user_id: userId,
        role: role,
        content: filteredText, // ✅ CRITICAL FIX: Use filtered text
      };
      
      const { error } = await supabase.from('messages').insert([messageData]);
      
      if (!error) {
        logger.debug(`[VoiceCall] ✅ Saved ${role} voice message`);
      }
    } catch (error) {
      logger.error('[VoiceCall] Error saving message:', error);
    }
  }

  /**
   * 🎵 Play subtle acknowledgment sounds for natural conversation flow
   * EXTRACTION_POINT: TTSService
   * TODO: Extract to TTSService.playAcknowledgment()
   */
  private playAcknowledgmentSound(): void {
    try {
      // Create a subtle "hmm" sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Very soft, low frequency for subtle acknowledgment
      oscillator.frequency.setValueAtTime(150, audioContext.currentTime); // Low hum
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.05); // Fade in
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2); // Fade out
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
      
      logger.debug('[VoiceCall] 🎵 Played acknowledgment sound');
    } catch (error) {
      // Silently fail - acknowledgment sounds are nice but not critical
      logger.debug('[VoiceCall] Could not play acknowledgment sound:', error);
    }
  }

  /**
   * ✅ IMPROVEMENT: Start network quality monitoring
   * Checks network connection quality every 5 seconds
   * EXTRACTION_POINT: NetworkMonitoringService
   * TODO: Extract to NetworkMonitoringService.start()
   */
  private startNetworkMonitoring(): void {
    if (this.networkCheckInterval) {
      return; // Already monitoring
    }

    this.networkCheckInterval = setInterval(async () => {
      if (!this.isActive) return;

      const quality = await this.checkNetworkQuality();
      const previousQuality = this.networkQuality;
      this.networkQuality = quality;

      // Log quality changes
      if (quality !== previousQuality) {
        logger.info(`[VoiceCall] 🌐 Network quality: ${previousQuality} → ${quality}`);
        
        // Notify UI if quality degraded
        if ((quality === 'poor' || quality === 'offline') && previousQuality !== 'poor' && previousQuality !== 'offline') {
          this.currentOptions?.onStatusChange?.('reconnecting');
        } else if ((quality === 'excellent' || quality === 'good') && (previousQuality === 'poor' || previousQuality === 'offline')) {
          // Quality improved - back to normal
          this.currentOptions?.onStatusChange?.('listening');
        }
      }
    }, this.NETWORK_CHECK_INTERVAL);
  }

  /**
   * ✅ IMPROVEMENT: Stop network quality monitoring
   * EXTRACTION_POINT: NetworkMonitoringService
   * TODO: Extract to NetworkMonitoringService.stop()
   */
  private stopNetworkMonitoring(): void {
    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
      this.networkCheckInterval = null;
    }
    this.recentApiLatencies = [];
    this.networkQuality = 'excellent';
  }

  /**
   * ✅ IMPROVEMENT: Check network quality by measuring API latency
   * EXTRACTION_POINT: NetworkMonitoringService
   * TODO: Extract to NetworkMonitoringService.checkQuality()
   */
  private async checkNetworkQuality(): Promise<'excellent' | 'good' | 'poor' | 'offline'> {
    try {
      const start = performance.now();
      
      // Use a lightweight health check endpoint or simple HEAD request
      const controller = new AbortController();
      const timeout = this.createTimeout(() => controller.abort(), 2000);
      
      try {
        // Try to fetch a lightweight endpoint (use existing API)
        // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
        const response = await fetch(getApiEndpoint('/api/health'), { 
          signal: controller.signal,
          method: 'HEAD', // HEAD request is lighter than GET
        });
        this.clearTrackedTimeout(timeout);
        
        const latency = performance.now() - start;
        
        if (!response.ok) {
          return 'offline';
        }

        // Track latency history
        this.recentApiLatencies.push(latency);
        if (this.recentApiLatencies.length > this.MAX_LATENCY_HISTORY) {
          this.recentApiLatencies.shift();
        }

        // Calculate average latency
        const avgLatency = this.recentApiLatencies.reduce((a, b) => a + b, 0) / this.recentApiLatencies.length;

        // Classify quality based on latency
        if (avgLatency < 100) return 'excellent';
        if (avgLatency < 300) return 'good';
        if (avgLatency < 1000) return 'poor';
        return 'offline';
      } catch (error) {
        this.clearTrackedTimeout(timeout);
        if (error.name === 'AbortError') {
          return 'offline';
        }
        throw error;
      }
    } catch (error) {
      logger.debug('[VoiceCall] Network check failed:', error);
      return 'offline';
    }
  }

  /**
   * ✅ IMPROVEMENT: Get adaptive STT timeout based on network quality
   * EXTRACTION_POINT: NetworkMonitoringService or STTService
   * ✅ EXTRACTED: Uses NetworkMonitoringService when feature flag enabled
   */
  private getSTTTimeout(audioBlobSize?: number): number {
    if (isFeatureEnabled('USE_NETWORK_MONITORING_SERVICE') && this.networkMonitoringService) {
      return this.networkMonitoringService.getSTTTimeout(audioBlobSize);
    }
    
    // Legacy implementation
    let baseTimeout: number;
    switch (this.networkQuality) {
      case 'excellent': 
        baseTimeout = 12000;  // ✅ FIX: 12s (was 10s) - handle large chunks
        break;
      case 'good': 
        baseTimeout = 8000;      // 8s
        break;
      case 'poor': 
        baseTimeout = 15000;     // 15s
        break;
      case 'offline': 
        baseTimeout = 20000;  // 20s
        break;
      default: 
        baseTimeout = 10000;
    }
    
    // ✅ FIX: Increase timeout for large chunks (>200KB need more time)
    if (audioBlobSize && audioBlobSize > 200 * 1024) {
      return Math.max(baseTimeout, 15000); // At least 15s for large chunks
    }
    
    return baseTimeout;
  }

  /**
   * ✅ IMPROVEMENT: Get current network quality (for UI display)
   * EXTRACTION_POINT: NetworkMonitoringService
   * ✅ EXTRACTED: Uses NetworkMonitoringService when feature flag enabled (with legacy fallback)
   */
  getNetworkQuality(): 'excellent' | 'good' | 'poor' | 'offline' {
    if (isFeatureEnabled('USE_NETWORK_MONITORING_SERVICE') && this.networkMonitoringService) {
      return this.networkMonitoringService.getQuality();
    }
    
    // Legacy implementation
    return this.networkQuality;
  }
}

export const voiceCallService = new VoiceCallService();
