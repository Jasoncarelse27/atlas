import { supabase } from '@/lib/supabaseClient';
import { getSafeUserMedia } from '@/utils/audioHelpers';
import { logger } from '../lib/logger';

interface VoiceCallOptions {
  userId: string;
  conversationId: string;
  tier: 'studio';
  onTranscript: (text: string) => void;
  onAIResponse: (text: string) => void;
  onError: (error: Error) => void;
  onStatusChange?: (status: 'listening' | 'transcribing' | 'thinking' | 'speaking') => void;
}

export class VoiceCallService {
  private isActive = false;
  private mediaRecorder: MediaRecorder | null = null;
  private callStartTime: Date | null = null;
  private currentOptions: VoiceCallOptions | null = null;
  private maxCallDuration = 30 * 60 * 1000; // 30 minutes in milliseconds
  private durationCheckInterval: NodeJS.Timeout | null = null;
  private recordingMimeType: string = 'audio/webm'; // ✅ Store detected MIME type
  
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
    
    // Start recording loop
    await this.startRecordingLoop(options);
    
    logger.info('[VoiceCall] ✅ Call started with real-time audio processing');
  }
  
  async stopCall(userId: string): Promise<void> {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Clear duration check interval
    if (this.durationCheckInterval) {
      clearInterval(this.durationCheckInterval);
      this.durationCheckInterval = null;
    }
    
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
      // Get microphone stream - SIMPLE, no fancy constraints
      const stream = await getSafeUserMedia({ audio: true });
      
      // Create MediaRecorder with explicit high-quality settings
      this.mediaRecorder = new MediaRecorder(stream, {
        audioBitsPerSecond: 128000  // 128kbps - guaranteed audio data
      });
      
      // Store MIME type
      this.recordingMimeType = this.mediaRecorder.mimeType;
      logger.info(`[VoiceCall] 🎙️ Recording: ${this.recordingMimeType} @ 128kbps`);
      
      // 4️⃣ CHUNK COLLECTION WITH VALIDATION
      let audioChunks: Blob[] = [];
      let chunkCount = 0;
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          chunkCount++;
          
          // Debug logging every second (100ms × 10)
          if (chunkCount % 10 === 0) {
            const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
            logger.debug(`[VoiceCall] Chunks: ${chunkCount}, Total: ${(totalSize/1024).toFixed(1)}KB`);
          }
        }
      };
      
      // 5️⃣ PROCESSING WITH COMPREHENSIVE VALIDATION
      this.mediaRecorder.onstop = async () => {
        if (!this.isActive) return;
        
        // Validate chunks exist
        const totalChunks = audioChunks.length;
        const totalSize = audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        const expectedMinSize = 20000; // ~20KB minimum for 5s (browser defaults)
        
        logger.info(`[VoiceCall] 🎤 Recording complete: ${totalChunks} chunks, ${(totalSize/1024).toFixed(1)}KB`);
        
        // Skip if too small (likely silence or MediaRecorder issue)
        if (totalSize < expectedMinSize) {
          logger.warn(`[VoiceCall] ⚠️ Audio too small (${(totalSize/1024).toFixed(1)}KB < ${(expectedMinSize/1024).toFixed(1)}KB min) - check microphone`);
          audioChunks = [];
          this.restartRecording();
          return;
        }
        
        // 6️⃣ CREATE BLOB WITH CORRECT MIME TYPE (no more hardcoding!)
        const audioBlob = new Blob(audioChunks, { type: this.recordingMimeType });
        audioChunks = [];
        
        // 7️⃣ PROCESS CHUNK
        await this.processVoiceChunk(audioBlob, options);
        
        // Restart for next chunk
        this.restartRecording();
      };
      
      // 8️⃣ START WITH OPTIMAL TIMESLICE
      this.mediaRecorder.start(100); // 100ms chunks for smooth accumulation
      setTimeout(() => {
        if (this.mediaRecorder?.state === 'recording') {
          this.mediaRecorder.stop();
        }
      }, 5000);
      
    } catch (error) {
      logger.error('[VoiceCall] Recording setup failed:', error);
      this.isActive = false;
      options.onError(error as Error);
    }
  }
  
  /**
   * Helper method to restart recording for next chunk
   */
  private restartRecording(): void {
    if (this.isActive && this.mediaRecorder) {
      this.mediaRecorder.start(100);
      setTimeout(() => {
        if (this.mediaRecorder?.state === 'recording') {
          this.mediaRecorder.stop();
        }
      }, 5000);
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
      // Update status: transcribing
      options.onStatusChange?.('transcribing');
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
      
      // Save user's voice message to database
      await this.saveVoiceMessage(transcript, 'user', options.conversationId, options.userId);
      
      // Update status: thinking
      options.onStatusChange?.('thinking');
      
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
      
      // Save Atlas's response to database
      await this.saveVoiceMessage(aiResponse, 'assistant', options.conversationId, options.userId);
      
      // Update status: speaking
      options.onStatusChange?.('speaking');
      
      // 4. Call TTS Edge Function directly with Studio tier HD voice
      const ttsResponse = await fetch(`${supabaseUrl}/functions/v1/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ 
          text: aiResponse, 
          voice: 'nova',
          model: 'tts-1-hd' // ✅ HD voice for Studio tier
        }),
      });
      
      if (!ttsResponse.ok) {
        const error = await ttsResponse.json().catch(() => ({}));
        throw new Error(`TTS failed: ${error.error || ttsResponse.statusText}`);
      }
      
      const ttsResult = await ttsResponse.json();
      
      // 5. Play audio with proper error handling
      const audioDataUrl = `data:audio/mp3;base64,${ttsResult.base64Audio}`;
      const audio = new Audio(audioDataUrl);
      
      // Store reference to prevent garbage collection
      (window as any).__atlasAudioElement = audio;
      
      // Add event listeners for debugging
      audio.onloadeddata = () => logger.debug('[VoiceCall] Audio data loaded');
      audio.onplay = () => logger.info('[VoiceCall] ✅ Audio playing');
      audio.onerror = (e) => logger.error('[VoiceCall] Audio error:', e);
      audio.onended = () => {
        logger.debug('[VoiceCall] Audio playback ended');
        options.onStatusChange?.('listening'); // ✅ Back to listening after audio ends
        delete (window as any).__atlasAudioElement;
      };
      
      try {
        await audio.play();
        logger.info('[VoiceCall] ✅ TTS audio played successfully');
      } catch (playError: any) {
        logger.error('[VoiceCall] ❌ Audio playback failed:', playError.message);
        // Try alternative playback method using AudioContext
        try {
          const audioContext = new AudioContext();
          const binaryString = atob(ttsResult.base64Audio);
          const arrayBuffer = new ArrayBuffer(binaryString.length);
          const uint8Array = new Uint8Array(arrayBuffer);
          for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
          }
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);
          source.start(0);
          logger.info('[VoiceCall] ✅ Audio played via AudioContext fallback');
        } catch (fallbackError) {
          logger.error('[VoiceCall] ❌ AudioContext fallback also failed:', fallbackError);
          throw new Error('Unable to play audio - both methods failed');
        }
      }
      
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
      // Backend will fetch conversation history automatically for Studio tier
      const response = await fetch('/api/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId: conversationId,
          is_voice_call: true // ✅ Flag for backend to optimize for voice
        })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Backend error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 🔍 DEBUG: Log the raw backend response
      logger.warn('[VoiceCall] Raw backend response:', JSON.stringify(data, null, 2));
      
      // ✅ Extract text from backend response structure
      // Backend returns: { success: true, response: { content: { text: "..." } } }
      let responseText = '';
      
      if (data.response?.content?.text) {
        // Standard message object format
        responseText = data.response.content.text;
      } else if (typeof data.response === 'string') {
        // Direct string response
        responseText = data.response;
      } else if (data.message?.content?.text) {
        // Fallback to message field
        responseText = data.message.content.text;
      } else if (typeof data.text === 'string') {
        // Simple text field
        responseText = data.text;
      } else {
        logger.error('[VoiceCall] Could not extract text from backend response:', data);
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
  
  /**
   * Save voice message to database so it appears in conversation history
   */
  private async saveVoiceMessage(
    text: string,
    role: 'user' | 'assistant',
    conversationId: string,
    userId: string
  ): Promise<void> {
    try {
      // ✅ CORRECT: Match actual schema with user_id
      const messageData = {
        conversation_id: conversationId,
        user_id: userId,
        role: role,
        content: text,
        // created_at auto-populated by database DEFAULT NOW()
      };
      
      // @ts-ignore - Supabase generated types don't match runtime schema
      const { error } = await supabase
        .from('messages')
        .insert([messageData]);
      
      if (error) {
        logger.error('[VoiceCall] Failed to save message:', error.message);
      } else {
        logger.debug(`[VoiceCall] ✅ Saved ${role} voice message`);
      }
    } catch (error) {
      logger.error('[VoiceCall] Error saving message:', error);
      // Don't throw - don't break the call flow
    }
  }
}

export const voiceCallService = new VoiceCallService();
