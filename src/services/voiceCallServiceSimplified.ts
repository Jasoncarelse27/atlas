import { supabase } from '@/lib/supabaseClient';
import { getSafeUserMedia } from '@/utils/audioHelpers';
import { conversationBuffer } from '@/utils/conversationBuffer';
import { getApiEndpoint } from '@/utils/apiClient';
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
  onAudioLevel?: (level: number) => void;
}

/**
 * Simplified Voice Call Service
 * ~800 lines instead of 1,600
 * Removes: network monitoring, complex resume logic, acknowledgment sounds
 * Keeps: Core VAD, STT, TTS, cleanup
 */
export class VoiceCallServiceSimplified {
  private isActive = false;
  private mediaRecorder: MediaRecorder | null = null;
  private callStartTime: Date | null = null;
  private currentOptions: VoiceCallOptions | null = null;
  private readonly maxCallDuration = 30 * 60 * 1000; // 30 minutes
  private durationCheckInterval: NodeJS.Timeout | null = null;
  
  // VAD (Voice Activity Detection)
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private vadCheckInterval: NodeJS.Timeout | null = null;
  
  // Simple state tracking
  private isSpeaking = false;
  private silenceStartTime: number | null = null;
  private isProcessing = false;
  private baselineNoiseLevel = 0.02; // Simple threshold
  
  async startCall(options: VoiceCallOptions): Promise<void> {
    if (this.isActive) {
      throw new Error('Call already in progress');
    }
    
    if (options.tier !== 'studio') {
      throw new Error('Voice calls are only available for Studio tier');
    }
    
    this.isActive = true;
    this.callStartTime = new Date();
    this.currentOptions = options;
    
    // Start duration check
    this.durationCheckInterval = setInterval(() => {
      if (this.callStartTime) {
        const elapsed = Date.now() - this.callStartTime.getTime();
        if (elapsed >= this.maxCallDuration) {
          logger.warn('[VoiceCall] Maximum call duration reached');
          this.stopCall(options.userId);
          options.onError(new Error('Maximum call duration reached (30 minutes)'));
        }
      }
    }, 60000); // Check every minute
    
    try {
      await this.startRecording(options);
      logger.info('[VoiceCall] Call started');
    } catch (error) {
      this.isActive = false;
      throw error;
    }
  }
  
  async stopCall(userId: string): Promise<void> {
    if (!this.isActive) return;
    
    logger.info('[VoiceCall] Stopping call...');
    this.isActive = false;
    
    // Clear intervals
    if (this.durationCheckInterval) {
      clearInterval(this.durationCheckInterval);
      this.durationCheckInterval = null;
    }
    if (this.vadCheckInterval) {
      clearInterval(this.vadCheckInterval);
      this.vadCheckInterval = null;
    }
    
    // Stop audio
    audioQueueService.interrupt();
    audioQueueService.reset();
    
    // Stop recording
    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
        this.mediaRecorder.stream.getTracks().forEach(track => {
          track.stop();
        });
      } catch (error) {
        logger.warn('[VoiceCall] Error stopping recorder:', error);
      }
      this.mediaRecorder = null;
    }
    
    // Cleanup audio context
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
    
    // Track usage
    if (this.callStartTime) {
      const duration = (Date.now() - this.callStartTime.getTime()) / 1000;
      await this.trackCallMetering(userId, duration);
    }
    
    conversationBuffer.clear();
    this.currentOptions = null;
    logger.info('[VoiceCall] Call ended');
  }
  
  private async startRecording(options: VoiceCallOptions): Promise<void> {
    try {
      const stream = await getSafeUserMedia({ audio: true });
      
      // Setup Web Audio API for VAD
      this.audioContext = new AudioContext();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.microphone.connect(this.analyser);
      
      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });
      
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
        
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        audioChunks = [];
        
        if (audioBlob.size > 1000) { // Min 1KB
          await this.processAudio(audioBlob, options);
        }
        
        // Restart recording if still active
        if (this.isActive && this.mediaRecorder?.state === 'inactive') {
          this.mediaRecorder.start();
        }
      };
      
      // Start VAD monitoring
      this.startVAD(options);
      
      // Start recording
      this.mediaRecorder.start();
      logger.debug('[VoiceCall] Recording started');
      
    } catch (error) {
      logger.error('[VoiceCall] Recording setup failed:', error);
      options.onError(error instanceof Error ? error : new Error('Failed to access microphone'));
    }
  }
  
  private startVAD(options: VoiceCallOptions): void {
    const dataArray = new Uint8Array(this.analyser!.fftSize);
    
    const checkAudio = () => {
      if (!this.isActive || !this.analyser) return;
      
      // Don't check while processing
      if (this.isProcessing) return;
      
      // Check if Atlas is speaking
      const isAtlasSpeaking = audioQueueService.getIsPlaying();
      if (isAtlasSpeaking) {
        if (this.mediaRecorder?.state === 'recording') {
          this.mediaRecorder.stop();
        }
        return;
      }
      
      // Get audio level
      this.analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const audioLevel = Math.sqrt(sum / dataArray.length);
      
      options.onAudioLevel?.(audioLevel);
      
      const now = Date.now();
      const threshold = 0.02; // Simple fixed threshold
      
      if (audioLevel > threshold) {
        // User is speaking
        this.isSpeaking = true;
        this.silenceStartTime = null;
        
        // Interrupt Atlas if playing
        if (isAtlasSpeaking) {
          audioQueueService.interrupt();
        }
      } else {
        // Silence detected
        if (this.isSpeaking) {
          if (this.silenceStartTime === null) {
            this.silenceStartTime = now;
          } else if (now - this.silenceStartTime > 500) { // 500ms of silence
            // Process speech
            this.isSpeaking = false;
            this.silenceStartTime = null;
            if (this.mediaRecorder?.state === 'recording') {
              this.mediaRecorder.stop();
            }
          }
        }
      }
    };
    
    this.vadCheckInterval = setInterval(checkAudio, 50);
  }
  
  private async processAudio(audioBlob: Blob, options: VoiceCallOptions): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    try {
      // 1. STT
      options.onStatusChange?.('transcribing');
      const transcript = await this.transcribeAudio(audioBlob);
      
      if (!transcript || transcript.length < 2) {
        return; // Too short, ignore
      }
      
      logger.info('[VoiceCall] User:', transcript);
      options.onTranscript(transcript);
      conversationBuffer.add('user', transcript);
      
      // 2. Get AI response
      options.onStatusChange?.('thinking');
      const response = await this.getAIResponse(transcript, options);
      
      if (!response) return;
      
      logger.info('[VoiceCall] Atlas:', response.substring(0, 100));
      options.onAIResponse(response);
      conversationBuffer.add('assistant', response);
      
      // 3. Play response
      options.onStatusChange?.('speaking');
      await this.playResponse(response);
      
      options.onStatusChange?.('listening');
      
    } catch (error) {
      logger.error('[VoiceCall] Processing error:', error);
      options.onError(error instanceof Error ? error : new Error('Processing failed'));
    } finally {
      this.isProcessing = false;
    }
  }
  
  private async transcribeAudio(audioBlob: Blob): Promise<string> {
    const base64Audio = await this.blobToBase64(audioBlob);
    const { data: { session } } = await supabase.auth.getSession();
    
    // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
    const response = await fetch(getApiEndpoint('/api/stt-deepgram'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ 
        audio: base64Audio.split(',')[1]
      })
    });
    
    if (!response.ok) {
      throw new Error('STT failed');
    }
    
    const result = await response.json();
    return result.text || '';
  }
  
  private async getAIResponse(transcript: string, options: VoiceCallOptions): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    
    // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
    const response = await fetch(getApiEndpoint('/api/message?stream=1'), {
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
        context: conversationBuffer.getRecent(5),
      })
    });
    
    if (!response.ok) {
      throw new Error('AI response failed');
    }
    
    // Parse SSE stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    
    audioQueueService.reset();
    let sentenceIndex = 0;
    let currentSentence = '';
    
    while (reader) {
      const { done, value } = await reader.read();
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
              
              // Split sentences
              const sentences = currentSentence.split(/([.!?]+)\s+/);
              for (let i = 0; i < sentences.length - 1; i += 2) {
                const sentence = sentences[i] + (sentences[i + 1] || '');
                if (sentence.trim().length > 3) {
                  audioQueueService.addSentence(sentence.trim(), sentenceIndex++, 'nova');
                }
              }
              currentSentence = sentences[sentences.length - 1] || '';
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    
    // Add final sentence
    if (currentSentence.trim()) {
      audioQueueService.addSentence(currentSentence.trim(), sentenceIndex, 'nova');
    }
    
    return fullResponse;
  }
  
  private async playResponse(response: string): Promise<void> {
    // Audio queue service handles TTS and playback
    return new Promise((resolve) => {
      audioQueueService.setOnComplete(() => {
        resolve();
      });
    });
  }
  
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  private async trackCallMetering(userId: string, durationSeconds: number): Promise<void> {
    try {
      const sttCost = (durationSeconds / 60) * 0.006;
      const ttsCost = (durationSeconds * 25 / 1000) * 0.015;
      
      await supabase.from('usage_logs').insert({
        user_id: userId,
        event: 'voice_call_completed',
        data: {
          duration_seconds: durationSeconds,
          estimated_cost: sttCost + ttsCost,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[VoiceCall] Metering failed:', error);
    }
  }
}

export const voiceCallServiceSimplified = new VoiceCallServiceSimplified();
