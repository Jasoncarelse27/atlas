import { supabase } from '@/lib/supabaseClient';
import { getSafeUserMedia } from '@/utils/audioHelpers';
import { conversationBuffer } from '@/utils/conversationBuffer';
import { isFeatureEnabled } from '../config/featureFlags';
import { logger } from '../lib/logger';
import { audioQueueService } from './audioQueueService';

interface VoiceCallOptions {
  userId: string;
  conversationId: string;
  tier: 'studio';
  onTranscript: (text: string) => void;
  onAIResponse: (text: string) => void;
  onError: (error: Error) => void;
  onStatusChange?: (status: 'listening' | 'transcribing' | 'thinking' | 'speaking') => void;
  onAudioLevel?: (level: number) => void; // 0-1 for VAD feedback
}

export class VoiceCallService {
  private isActive = false;
  private mediaRecorder: MediaRecorder | null = null;
  private callStartTime: Date | null = null;
  private currentOptions: VoiceCallOptions | null = null;
  private maxCallDuration = 30 * 60 * 1000; // 30 minutes in milliseconds
  private durationCheckInterval: NodeJS.Timeout | null = null;
  private recordingMimeType: string = 'audio/webm'; // ✅ Store detected MIME type
  private readonly RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s
  private readonly MAX_RETRIES = 3;
  private currentAudio: HTMLAudioElement | null = null; // ✅ Track current playing audio
  
  // 🎙️ CHATGPT-STYLE VAD (Voice Activity Detection)
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private vadCheckInterval: NodeJS.Timeout | null = null;
  private silenceStartTime: number | null = null;
  private readonly SILENCE_DURATION = 1000; // 🎯 NATURAL: Allow natural pauses (1.0s)
  private readonly MIN_SPEECH_DURATION = 1500; // 🎯 Require 1.5+ seconds of speech (filters noise bursts)
  private lastSpeechTime: number = 0;
  private lastProcessTime: number = 0; // 🛑 Track last processing time to prevent loops
  private readonly MIN_PROCESS_INTERVAL = 3000; // 🛑 Min 3 seconds between processing attempts
  
  // 🎯 SMART ADAPTIVE THRESHOLD
  private baselineNoiseLevel: number = 0;
  private adaptiveThreshold: number = 0.02; // Starts at 2%, adjusts based on environment
  private isCalibrated: boolean = false;
  private hasInterrupted: boolean = false; // 🛑 Track if user already interrupted
  
  async startCall(options: VoiceCallOptions): Promise<void> {
    if (this.isActive) {
      throw new Error('Call already in progress');
    }
    
    // Studio tier only
    if (options.tier !== 'studio') {
      throw new Error('Voice calls are only available for Studio tier');
    }
    
    this.isActive = true;
    this.callStartTime = new Date();
    this.currentOptions = options;
    
    // Start 30-minute duration enforcement
    this.durationCheckInterval = setInterval(() => {
      if (this.callStartTime) {
        const elapsed = Date.now() - this.callStartTime.getTime();
        if (elapsed >= this.maxCallDuration) {
          logger.warn('[VoiceCall] ⏰ Maximum call duration reached (30 minutes)');
          this.stopCall(options.userId);
          options.onError(new Error('Maximum call duration reached (30 minutes)'));
        }
      }
    }, 30000); // Check every 30 seconds
    
    // Start recording loop with VAD
    await this.startRecordingWithVAD(options);
    
    logger.info('[VoiceCall] ✅ Call started with ChatGPT-style VAD');
  }
  
  async stopCall(userId: string): Promise<void> {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Clear duration check interval
    if (this.durationCheckInterval) {
      clearInterval(this.durationCheckInterval);
      this.durationCheckInterval = null;
    }
    
    // Clear VAD check interval
    if (this.vadCheckInterval) {
      clearInterval(this.vadCheckInterval);
      this.vadCheckInterval = null;
    }
    
    // ✅ FIX: Stop any playing audio when call ends
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    // Stop recording
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder = null;
    }
    
    // Cleanup VAD audio context
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    // Track call in usage logs
    if (this.callStartTime) {
      const duration = (Date.now() - this.callStartTime.getTime()) / 1000;
      await this.trackCallMetering(userId, duration);
    }
    
    // Clear conversation buffer
    conversationBuffer.clear();
    
    this.currentOptions = null;
    logger.info('[VoiceCall] ✅ Call ended');
  }
  
  /**
   * 🚀 CHATGPT-STYLE: Voice Activity Detection Recording
   * Detects when user stops speaking and processes immediately
   */
  private async startRecordingWithVAD(options: VoiceCallOptions): Promise<void> {
    try {
      // Get microphone stream
      const stream = await getSafeUserMedia({ audio: true });
      
      // Setup Web Audio API for VAD
      this.audioContext = new AudioContext();
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8; // Smooth out noise
      
      this.microphone.connect(this.analyser);
      
      // 🎯 SMART THRESHOLD: Calibrate ambient noise for first 2 seconds BEFORE starting VAD
      await this.calibrateAmbientNoise();
      
      // Create MediaRecorder for audio capture
      this.mediaRecorder = new MediaRecorder(stream, {
        audioBitsPerSecond: 128000  // 128kbps
      });
      
      this.recordingMimeType = this.mediaRecorder.mimeType;
      logger.info(`[VoiceCall] 🎙️ VAD enabled: ${this.recordingMimeType}`);
      
      // Audio chunk collection
      let audioChunks: Blob[] = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = async () => {
        if (!this.isActive || audioChunks.length === 0) {
          audioChunks = [];
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
        
        // Process the chunk
        await this.processVoiceChunk(audioBlob, options);
        
        // Restart recording
        this.restartRecordingVAD();
      };
      
      // Start VAD monitoring AFTER calibration
      this.startVADMonitoring(options);
      
      // Start recording
      this.mediaRecorder.start(100);
      
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
   */
  private async calibrateAmbientNoise(): Promise<void> {
    if (!this.analyser) return;
    
    logger.info('[VoiceCall] 🔧 Calibrating ambient noise level...');
    
    const samples: number[] = [];
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    // Collect 20 samples over 2 seconds
    for (let i = 0; i < 20; i++) {
      this.analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      samples.push(average / 255);
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Calculate baseline (median to avoid outliers)
    samples.sort((a, b) => a - b);
    this.baselineNoiseLevel = samples[Math.floor(samples.length / 2)];
    
    // Set adaptive threshold (2.5x baseline, min 0.12 for noisy environments)
    this.adaptiveThreshold = Math.max(this.baselineNoiseLevel * 2.5, 0.12);
    this.isCalibrated = true;
    
    logger.info(`[VoiceCall] ✅ Calibrated - Baseline: ${(this.baselineNoiseLevel * 100).toFixed(1)}%, Threshold: ${(this.adaptiveThreshold * 100).toFixed(1)}%`);
  }
  
  /**
   * 🔊 VAD Monitoring: Detect when user starts/stops speaking
   */
  private startVADMonitoring(options: VoiceCallOptions): void {
    const dataArray = new Uint8Array(this.analyser!.frequencyBinCount);
    
    const checkVAD = () => {
      if (!this.isActive || !this.analyser) return;
      
      // Get audio level
      this.analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const audioLevel = average / 255; // 0-1
      
      // Send audio level to UI for visualization
      options.onAudioLevel?.(audioLevel);
      
      const now = Date.now();
      
      // 🎯 Use adaptive threshold (or default if not calibrated yet)
      const threshold = this.isCalibrated ? this.adaptiveThreshold : 0.02;
      
      // Detect speech vs silence
      if (audioLevel > threshold) {
        // User is speaking
        this.silenceStartTime = null;
        this.lastSpeechTime = now;
        
        // 🛑 TAP TO INTERRUPT: If user speaks while Atlas is playing (ONCE per burst)
        if (!this.hasInterrupted) {
          if (isFeatureEnabled('VOICE_STREAMING')) {
            audioQueueService.interrupt(); // Stop queue playback
            this.hasInterrupted = true;
            logger.info('[VoiceCall] 🛑 User interrupted - stopping queue');
          } else if (this.currentAudio && !this.currentAudio.paused) {
            // User interrupted! Stop Atlas immediately
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
            this.hasInterrupted = true;
            logger.info('[VoiceCall] 🛑 User interrupted - stopping playback');
          }
        }
        options.onStatusChange?.('listening');
      } else {
        // Silence detected
        if (this.silenceStartTime === null) {
          this.silenceStartTime = now;
        }
        
        // Check if silence duration exceeded
        const silenceDuration = now - this.silenceStartTime;
        const speechDuration = now - this.lastSpeechTime;
        const timeSinceLastProcess = now - this.lastProcessTime;
        
        // ⚡ Process after 1.0s silence + 1.5s+ speech + 3s cooldown
        if (
          silenceDuration >= this.SILENCE_DURATION &&
          speechDuration >= this.MIN_SPEECH_DURATION &&
          timeSinceLastProcess >= this.MIN_PROCESS_INTERVAL &&
          this.mediaRecorder?.state === 'recording'
        ) {
          logger.debug('[VoiceCall] 🤫 Silence detected - processing speech');
          this.lastProcessTime = now; // Update cooldown timer
          this.mediaRecorder.stop();
          this.silenceStartTime = null; // Reset
          this.hasInterrupted = false; // Reset interrupt flag after real silence
        }
      }
    };
    
    // Check every 50ms for responsive VAD
    this.vadCheckInterval = setInterval(checkVAD, 50);
  }
  
  /**
   * Helper method to restart recording for next chunk
   */
  private restartRecordingVAD(): void {
    if (this.isActive && this.mediaRecorder) {
      // ✅ FIX: Don't record while Atlas is speaking (check both standard AND streaming audio)
      const isAtlasSpeaking = 
        (this.currentAudio && !this.currentAudio.paused) || 
        (isFeatureEnabled('VOICE_STREAMING') && audioQueueService.getIsPlaying());
      
      if (isAtlasSpeaking) {
        logger.debug('[VoiceCall] Skipping recording - Atlas is still speaking');
        setTimeout(() => this.restartRecordingVAD(), 500);
        return;
      }
      
      // ✅ FIX: Check if already recording before starting
      if (this.mediaRecorder.state === 'inactive') {
        this.mediaRecorder.start(100);
        logger.debug('[VoiceCall] 🎙️ Mic restarted - ready for next input');
      }
    }
  }
  
  /**
   * Process a single voice chunk: Route to streaming or standard mode
   */
  private async processVoiceChunk(
    audioBlob: Blob,
    options: VoiceCallOptions
  ): Promise<void> {
    // Route to streaming or standard based on feature flag
    if (isFeatureEnabled('VOICE_STREAMING')) {
      return this.processVoiceChunkStreaming(audioBlob, options);
    } else {
      return this.processVoiceChunkStandard(audioBlob, options);
    }
  }

  /**
   * Standard (non-streaming) voice processing
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
      const ttsResult = await this.retryWithBackoff(async () => {
        const ttsResponse = await fetch(`${supabaseUrl}/functions/v1/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ 
            text: aiResponse, 
            voice: 'nova',
            model: 'tts-1-hd'
          }),
        });
        
        if (!ttsResponse.ok) {
          const error = await ttsResponse.json().catch(() => ({}));
          throw new Error(`TTS failed: ${error.error || ttsResponse.statusText}`);
        }
        
        return await ttsResponse.json();
      }, 'Text-to-Speech');
      
      // 5. Play audio
      if (this.currentAudio && !this.currentAudio.paused) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio = null;
      }
      
      const audioDataUrl = `data:audio/mp3;base64,${ttsResult.base64Audio}`;
      const audio = new Audio(audioDataUrl);
      this.currentAudio = audio;
      
      (window as any).__atlasAudioElement = audio;
      
      audio.onloadeddata = () => logger.debug('[VoiceCall] Audio data loaded');
      audio.onplay = () => logger.info('[VoiceCall] ✅ Audio playing');
      audio.onerror = (e) => logger.error('[VoiceCall] Audio error:', e);
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
      
    } catch (error) {
      logger.error('[VoiceCall] Chunk processing error:', error);
    }
  }
  
  /**
   * Streaming voice processing: STT → Claude Stream → Progressive TTS
   */
  private async processVoiceChunkStreaming(
    audioBlob: Blob,
    options: VoiceCallOptions
  ): Promise<void> {
    const startTime = performance.now(); // ⏱️ Start latency tracking
    try {
      options.onStatusChange?.('transcribing');
      const { data: { session } } = await supabase.auth.getSession();
      
      // 1. STT - Call OpenAI Whisper directly (bypassing Supabase Edge Function)
      const sttStart = performance.now();
      logger.info(`[VoiceCall] ⏱️ Audio blob size: ${(audioBlob.size / 1024).toFixed(1)}KB`);
      
      // Skip if audio blob is too small (< 20KB = likely just noise)
      if (audioBlob.size < 20 * 1024) {
        logger.warn(`[VoiceCall] ⚠️ Audio too small (${(audioBlob.size / 1024).toFixed(1)}KB), skipping`);
        this.restartRecordingVAD();
        return;
      }
      
      const transcript = await this.retryWithBackoff(async () => {
        // Convert audio blob to base64 for Deepgram
        const base64Audio = await this.blobToBase64(audioBlob);
        const { data: { session } } = await supabase.auth.getSession();
        
        const fetchStart = performance.now();
        
        // Call Deepgram via backend (22x faster than Whisper)
        const sttResponse = await fetch('/api/stt-deepgram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ 
            audio: base64Audio.split(',')[1] // Remove data:audio/webm;base64, prefix
          }),
        });
        
        logger.info(`[VoiceCall] ⏱️ STT fetch: ${(performance.now() - fetchStart).toFixed(0)}ms`);
        
        if (!sttResponse.ok) {
          const error = await sttResponse.text();
          throw new Error(`STT failed: ${error}`);
        }
        
        const result = await sttResponse.json();
        logger.info(`[VoiceCall] 📊 Deepgram confidence: ${(result.confidence * 100).toFixed(1)}%`);
        return result.text;
      }, 'Speech Recognition');
      
      if (!transcript?.trim()) return;
      
      logger.info(`[VoiceCall] ⏱️ STT: ${(performance.now() - sttStart).toFixed(0)}ms`);
      logger.info('[VoiceCall] 👤 User:', transcript);
      
      // Add user message to conversational buffer
      conversationBuffer.add('user', transcript);
      
      options.onTranscript(transcript);
      await this.saveVoiceMessage(transcript, 'user', options.conversationId, options.userId);
      
      options.onStatusChange?.('thinking');
      
      // 2. Claude Streaming
      const claudeStart = performance.now();
      const response = await fetch('/api/message?stream=1', {
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
          context: conversationBuffer.getRecent(5), // Send last 5 messages for context
        }),
      });
      
      if (!response.ok) throw new Error(`Claude streaming failed: ${response.statusText}`);
      
      const claudeConnectTime = performance.now() - claudeStart;
      logger.info(`[VoiceCall] ⏱️ Claude connect (TTFB): ${claudeConnectTime.toFixed(0)}ms`);
      
      // 3. Parse SSE stream
      const streamingStart = performance.now();
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let sentenceIndex = 0;
      let currentSentence = '';
      
      audioQueueService.reset(); // Clear queue for new response
      options.onStatusChange?.('speaking');
      
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
                fullResponse += data.chunk;
                currentSentence += data.chunk;
                
                // Split into sentences on .!? followed by space or newline
                const sentences = currentSentence.split(/([.!?]\s+)/);
                
                // Process complete sentences
                while (sentences.length >= 2) {
                  const sentence = sentences.shift()! + (sentences.shift() || '');
                  const cleanSentence = sentence.trim();
                  
                  if (cleanSentence.length > 3) {
                    await audioQueueService.addSentence(cleanSentence, sentenceIndex++, 'nova');
                    options.onAIResponse(fullResponse); // Update UI with partial response
                  }
                }
                
                currentSentence = sentences.join('');
              }
            } catch (e) {
              // Ignore parse errors for keep-alive messages
            }
          }
        }
      }
      
      // Process remaining sentence
      if (currentSentence.trim().length > 3) {
        await audioQueueService.addSentence(currentSentence.trim(), sentenceIndex++, 'nova');
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
      logger.error('[VoiceCall] Streaming error:', error);
      options.onError(error as Error);
    }
  }
  
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    operation: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          this.currentOptions?.onStatusChange?.('transcribing');
          logger.info(`[VoiceCall] Retry attempt ${attempt + 1}/${this.MAX_RETRIES} for ${operation}`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAYS[attempt - 1]));
        }
        
        return await fn();
      } catch (error: unknown) {
        lastError = error as Error;
        
        if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('429')) {
          throw error;
        }
        
        if (attempt === this.MAX_RETRIES - 1) {
          throw new Error(`Connection lost. Please check your internet connection.`);
        }
      }
    }
    
    throw lastError || new Error(`${operation} failed`);
  }
  
  private async getAIResponse(userMessage: string, conversationId: string): Promise<string> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }
      
      const response = await fetch('/api/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId: conversationId,
          is_voice_call: true
        })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Backend error: ${response.status}`);
      }
      
      const data = await response.json();
      
      let responseText = '';
      if (data.response?.content?.text) {
        responseText = data.response.content.text;
      } else if (typeof data.response === 'string') {
        responseText = data.response;
      } else {
        responseText = 'I apologize, I had trouble processing that response.';
      }
      
      return responseText;
    } catch (error) {
      logger.error('[VoiceCall] AI response error:', error);
      return 'I apologize, I encountered an error. Please try again.';
    }
  }
  
  private async trackCallMetering(userId: string, durationSeconds: number): Promise<void> {
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
  
  private async saveVoiceMessage(
    text: string,
    role: 'user' | 'assistant',
    conversationId: string,
    userId: string
  ): Promise<void> {
    try {
      const messageData = {
        conversation_id: conversationId,
        user_id: userId,
        role: role,
        content: text,
      };
      
      const { error } = await supabase.from('messages').insert([messageData]);
      
      if (!error) {
        logger.debug(`[VoiceCall] ✅ Saved ${role} voice message`);
      }
    } catch (error) {
      logger.error('[VoiceCall] Error saving message:', error);
    }
  }
}

export const voiceCallService = new VoiceCallService();
