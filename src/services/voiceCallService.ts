import { supabase } from '@/lib/supabaseClient';
import { getSafeUserMedia, getSupportedMimeType } from '@/utils/audioHelpers';
import { logger } from '../lib/logger';

interface VoiceCallOptions {
  userId: string;
  conversationId: string;
  tier: 'studio';
  onTranscript: (text: string) => void;
  onAIResponse: (text: string) => void;
  onError: (error: Error) => void;
}

export class VoiceCallService {
  private isActive = false;
  private mediaRecorder: MediaRecorder | null = null;
  private callStartTime: Date | null = null;
  private currentOptions: VoiceCallOptions | null = null;
  
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
    
    // Start recording loop
    await this.startRecordingLoop(options);
    
    logger.info('[VoiceCall] ✅ Call started with real-time audio processing');
  }
  
  async stopCall(userId: string): Promise<void> {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Stop recording
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder = null;
    }
    
    // Track call in usage logs
    if (this.callStartTime) {
      const duration = (Date.now() - this.callStartTime.getTime()) / 1000;
      await this.trackCallMetering(userId, duration);
    }
    
    this.currentOptions = null;
    logger.info('[VoiceCall] ✅ Call ended');
  }
  
  private async startRecordingLoop(options: VoiceCallOptions): Promise<void> {
    try {
      // Use safe getUserMedia with iOS compatibility
      const stream = await getSafeUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Use supported MIME type for browser compatibility
      const mimeType = getSupportedMimeType() || 'audio/webm';
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
      });
      
      let audioChunks: Blob[] = [];
      
      // Collect audio chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      // Process when recording stops (every 5 seconds)
      this.mediaRecorder.onstop = async () => {
        if (audioChunks.length > 0 && this.isActive) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          audioChunks = []; // Clear for next chunk
          
          // Process this chunk
          await this.processVoiceChunk(audioBlob, options);
          
          // Restart recording if call is still active
          if (this.isActive && this.mediaRecorder) {
            this.mediaRecorder.start();
            setTimeout(() => {
              if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
              }
            }, 5000); // Record for 5 seconds
          }
        }
      };
      
      // Start initial recording
      this.mediaRecorder.start();
      setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
        }
      }, 5000); // Record for 5 seconds
      
    } catch (error) {
      this.isActive = false;
      options.onError(error as Error);
    }
  }
  
  /**
   * Process a single voice chunk: STT → Claude → TTS → Play
   * DIRECT Edge Function calls (no voiceService intermediary)
   */
  private async processVoiceChunk(
    audioBlob: Blob,
    options: VoiceCallOptions
  ): Promise<void> {
    try {
      logger.debug('[VoiceCall] Processing voice chunk:', audioBlob.size, 'bytes');
      
      // 1. Convert audio blob to base64
      const base64Audio = await this.blobToBase64(audioBlob);
      
      // 2. Call STT Edge Function directly
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const sttResponse = await fetch(`${supabaseUrl}/functions/v1/stt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ audio: base64Audio.split(',')[1] }), // Remove data:audio/webm;base64, prefix
      });
      
      if (!sttResponse.ok) {
        const error = await sttResponse.json().catch(() => ({}));
        throw new Error(`STT failed: ${error.error || sttResponse.statusText}`);
      }
      
      const sttResult = await sttResponse.json();
      const transcript = sttResult.text;
      
      if (!transcript || transcript.trim().length === 0) {
        logger.debug('[VoiceCall] Empty transcript, skipping');
        return; // Silence, skip
      }
      
      logger.info('[VoiceCall] 👤 User:', transcript);
      options.onTranscript(transcript);
      
      // 3. Send to Claude for response
      let aiResponse = await this.getAIResponse(transcript, options.conversationId);
      
      // Ensure aiResponse is always a string (defensive programming)
      if (typeof aiResponse !== 'string') {
        logger.warn('[VoiceCall] AI response was not a string, converting:', typeof aiResponse);
        aiResponse = JSON.stringify(aiResponse);
      }
      
      // Log safely with substring protection
      const logPreview = aiResponse.length > 100 ? aiResponse.substring(0, 100) + '...' : aiResponse;
      logger.info('[VoiceCall] 🤖 Atlas:', logPreview);
      options.onAIResponse(aiResponse);
      
      // 4. Call TTS Edge Function directly
      const ttsResponse = await fetch(`${supabaseUrl}/functions/v1/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ text: aiResponse, voice: 'nova' }),
      });
      
      if (!ttsResponse.ok) {
        const error = await ttsResponse.json().catch(() => ({}));
        throw new Error(`TTS failed: ${error.error || ttsResponse.statusText}`);
      }
      
      const ttsResult = await ttsResponse.json();
      
      // 5. Play audio
      const audioDataUrl = `data:audio/mp3;base64,${ttsResult.base64Audio}`;
      const audio = new Audio(audioDataUrl);
      await audio.play();
      
      logger.debug('[VoiceCall] ✅ Chunk processed successfully');
      
    } catch (error) {
      logger.error('[VoiceCall] Chunk processing error:', error);
      // Don't stop call on processing errors, just log and continue
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
  
  private async getAIResponse(
    userMessage: string,
    conversationId: string
  ): Promise<string> {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }
      
      // Call backend /api/message endpoint
      const response = await fetch('/api/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: conversationId,
          is_voice_call: true // Flag for backend to know this is voice
        })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Backend error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Defensive extraction of response text
      let responseText = data.response || data.message || data.text || data.reply;
      
      // Ensure we always return a string
      if (typeof responseText !== 'string') {
        if (responseText && typeof responseText === 'object' && responseText.text) {
          responseText = responseText.text;
        } else {
          logger.warn('[VoiceCall] Backend response format unexpected:', data);
          responseText = 'I apologize, I had trouble understanding that.';
        }
      }
      
      return responseText;
    } catch (error) {
      logger.error('[VoiceCall] AI response error:', error);
      return 'I apologize, I encountered an error. Please try again.';
    }
  }
  
  private async trackCallMetering(userId: string, durationSeconds: number): Promise<void> {
    try {
      const monthYear = new Date().toISOString().slice(0, 7);
      
      // Estimate costs (OpenAI pricing)
      const sttCost = (durationSeconds / 60) * 0.006; // $0.006/min (Whisper)
      const estimatedTTSChars = durationSeconds * 25; // ~25 chars/sec speech
      const ttsCost = (estimatedTTSChars / 1000) * 0.015; // $0.015/1K chars (TTS-1)
      const totalCost = sttCost + ttsCost;
      
      logger.debug('[VoiceCall] Call metering:', {
        duration: `${durationSeconds.toFixed(1)}s`,
        sttCost: `$${sttCost.toFixed(4)}`,
        ttsCost: `$${ttsCost.toFixed(4)}`,
        totalCost: `$${totalCost.toFixed(4)}`,
      });
      
      // Track in usage_logs table
      // @ts-ignore - usage_logs schema not in generated types
      const { error } = await supabase.from('usage_logs').insert({
        user_id: userId,
        event: 'voice_call_completed',
        feature: 'voice_call',
        tokens_used: 0, // Not applicable for voice calls
        estimated_cost: totalCost,
        created_at: new Date().toISOString(),
        metadata: {
          duration_seconds: durationSeconds,
          stt_cost: sttCost,
          tts_cost: ttsCost,
          month_year: monthYear,
        },
        data: {
          duration_seconds: durationSeconds,
          cost_breakdown: {
            stt: sttCost,
            tts: ttsCost,
            total: totalCost
          }
        }
      });
      
      if (error) {
        if (error.message.includes('row-level security')) {
          logger.warn('[VoiceCall] RLS error - falling back to service role API');
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch('/api/usage-log', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
              },
              body: JSON.stringify({ 
                user_id: userId, 
                event: 'voice_call_completed',
                feature: 'voice_call', 
                estimated_cost: totalCost,
                metadata: {
                  duration_seconds: durationSeconds,
                  stt_cost: sttCost,
                  tts_cost: ttsCost,
                  month_year: monthYear,
                }
              }),
            });
            if (!response.ok) {
              logger.error('[VoiceCall] API usage log failed:', await response.text());
            } else {
              logger.info('[VoiceCall] ✅ Usage logged via API fallback');
            }
          } catch (apiError) {
            logger.error('[VoiceCall] API fallback failed:', apiError);
          }
        } else {
          logger.error('[VoiceCall] Usage log failed:', error.message);
        }
      } else {
        logger.info('[VoiceCall] ✅ Usage logged successfully');
      }
      
    } catch (error) {
      logger.error('[VoiceCall] Metering failed:', error);
      // Don't throw - don't block call end
    }
  }
}

export const voiceCallService = new VoiceCallService();
