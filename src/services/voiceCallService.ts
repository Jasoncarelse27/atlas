import { supabase } from '@/lib/supabaseClient';
import { audioUsageService } from './audioUsageService';
import { voiceService } from './voiceService';

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
    
    // Start continuous recording loop
    await this.startRecordingLoop(options);
  }
  
  async stopCall(userId: string): Promise<void> {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Stop recording
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder = null;
    }
    
    // Track call in intelligent metering
    if (this.callStartTime) {
      const duration = (Date.now() - this.callStartTime.getTime()) / 1000;
      await this.trackCallMetering(userId, duration);
    }
  }
  
  private async startRecordingLoop(options: VoiceCallOptions): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];
      
      // Collect audio in 3-second chunks for responsiveness
      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          
          // Process chunk
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          audioChunks.length = 0; // Clear for next chunk
          
          // Transcribe → Send to Claude → TTS → Play
          await this.processVoiceChunk(audioBlob, options);
        }
      };
      
      this.mediaRecorder.start(3000); // 3-second chunks
      
    } catch (error) {
      this.isActive = false;
      options.onError(error as Error);
    }
  }
  
  private async processVoiceChunk(
    audioBlob: Blob, 
    options: VoiceCallOptions
  ): Promise<void> {
    try {
      // 1. Transcribe user speech
      const transcript = await voiceService.recordAndTranscribe(audioBlob, 'studio');
      
      if (!transcript || transcript.trim().length === 0) {
        return; // Silence, skip
      }
      
      options.onTranscript(transcript);
      
      // 2. Send to Claude for response
      const aiResponse = await this.getAIResponse(transcript, options.conversationId);
      options.onAIResponse(aiResponse);
      
      // 3. Synthesize and play AI response
      const audioDataUrl = await voiceService.synthesizeSpeech(aiResponse);
      await voiceService.playAudio(audioDataUrl);
      
      // 4. Track usage
      await audioUsageService.trackUsage(
        options.userId, 
        'studio', 
        'tts', 
        undefined, 
        aiResponse.length
      );
      
    } catch (error) {
      console.error('[VoiceCall] Chunk processing error:', error);
      // Continue call despite errors
    }
  }
  
  private async getAIResponse(
    userMessage: string, 
    conversationId: string
  ): Promise<string> {
    // Call backend /api/message endpoint
    const response = await fetch('/api/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({
        message: userMessage,
        conversation_id: conversationId
      })
    });
    
    const data = await response.json();
    return data.response || 'I apologize, I had trouble understanding that.';
  }
  
  private async trackCallMetering(userId: string, durationSeconds: number): Promise<void> {
    const monthYear = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    
    // Estimate costs
    const sttCost = (durationSeconds / 60) * 0.006; // $0.006/min
    const estimatedTTSChars = durationSeconds * 25; // ~25 chars/sec speech
    const ttsCost = (estimatedTTSChars / 1000) * 0.030; // $0.030/1K chars
    const totalCost = sttCost + ttsCost;
    
    // Detect anomaly
    let isAnomaly = false;
    try {
      // @ts-ignore - RPC function type not available in client types
      const { data: anomalyCheck } = await supabase.rpc('detect_usage_anomaly', {
        p_user_id: userId,
        p_estimated_cost: totalCost
      }) as { data: boolean | null };
      isAnomaly = anomalyCheck || false;
    } catch (error) {
      // RPC function may not exist yet, continue without anomaly detection
      console.warn('[VoiceCall] Anomaly detection unavailable:', error);
    }
    
    // Update metering table
    const { data: existing } = await supabase
      .from('intelligent_metering')
      .select('*')
      .eq('user_id', userId)
      .eq('month_year', monthYear)
      .maybeSingle() as { data: any };
    
    if (existing) {
      const updateData = {
        voice_calls_count: existing.voice_calls_count + 1,
        stt_minutes: existing.stt_minutes + (durationSeconds / 60),
        estimated_cost: existing.estimated_cost + totalCost,
        anomaly_detected: isAnomaly,
        updated_at: new Date().toISOString()
      };
      // @ts-ignore - Table type not available in client types
      await supabase
        .from('intelligent_metering')
        .update(updateData)
        .eq('id', existing.id);
    } else {
      // @ts-ignore - Table type not available in client types
      await supabase.from('intelligent_metering').insert({
        user_id: userId,
        month_year: monthYear,
        voice_calls_count: 1,
        stt_minutes: durationSeconds / 60,
        estimated_cost: totalCost,
        anomaly_detected: isAnomaly
      });
    }
  }
}

export const voiceCallService = new VoiceCallService();

