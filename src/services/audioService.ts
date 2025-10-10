import { supabase } from '../lib/supabaseClient';

export interface AudioTranscriptionResult {
  text: string;
  confidence?: number;
  duration?: number;
}

export interface AudioEvent {
  event_type: 'recording_start' | 'recording_stop' | 'transcription_success' | 'transcription_fail';
  user_id: string;
  session_id?: string;
  tier: string;
  metadata?: Record<string, any>;
}

class AudioService {
  /**
   * Transcribe audio blob using Supabase Edge Function
   */
  async transcribeAudio(audioBlob: Blob, userId: string, sessionId?: string, tier: string = 'free'): Promise<AudioTranscriptionResult> {
    try {

      // Log recording start event
      await this.logAudioEvent({
        event_type: 'recording_start',
        user_id: userId,
        session_id: sessionId,
        tier,
        metadata: {
          blob_size: audioBlob.size,
          blob_type: audioBlob.type
        }
      });

      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));


      // Call STT Edge Function
      const { data, error } = await supabase.functions.invoke('stt', {
        body: { 
          audio: base64Audio,
          format: audioBlob.type || 'audio/wav'
        },
      });

      if (error) {
        
        // Log transcription failure
        await this.logAudioEvent({
          event_type: 'transcription_fail',
          user_id: userId,
          session_id: sessionId,
          tier,
          metadata: { error: error.message }
        });

        throw new Error(`STT service error: ${error.message}`);
      }

      if (!data?.text) {
        
        await this.logAudioEvent({
          event_type: 'transcription_fail',
          user_id: userId,
          session_id: sessionId,
          tier,
          metadata: { error: 'No transcription text received' }
        });

        throw new Error('No transcription text received');
      }


      // Log transcription success
      await this.logAudioEvent({
        event_type: 'transcription_success',
        user_id: userId,
        session_id: sessionId,
        tier,
        metadata: {
          text_length: data.text.length,
          confidence: data.confidence,
          duration: data.duration
        }
      });

      return {
        text: data.text,
        confidence: data.confidence,
        duration: data.duration
      };

    } catch (error) {
      
      // Log transcription failure
      await this.logAudioEvent({
        event_type: 'transcription_fail',
        user_id: userId,
        session_id: sessionId,
        tier,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      throw error;
    }
  }

  /**
   * Log audio events to Supabase analytics
   */
  async logAudioEvent(event: AudioEvent): Promise<void> {
    try {

      const { error } = await supabase
        .from('audio_events')
        .insert({
          event_type: event.event_type,
          user_id: event.user_id,
          session_id: event.session_id,
          tier: event.tier,
          metadata: event.metadata,
          created_at: new Date().toISOString()
        });

      if (error) {
        // Don't throw - logging failures shouldn't break the user flow
      } else {
      }
    } catch (error) {
      // Don't throw - logging failures shouldn't break the user flow
    }
  }

  /**
   * Check if user has audio permissions (Core/Studio tier)
   */
  canUseAudio(tier: string): boolean {
    return tier === 'core' || tier === 'studio';
  }

  /**
   * Get audio tier restriction message
   */
  getAudioRestrictionMessage(tier: string): string {
    if (tier === 'free') {
      return 'Voice recording is available for Core/Studio users. Upgrade to unlock audio features!';
    }
    return '';
  }

  /**
   * Play TTS audio (placeholder for future implementation)
   */
  play(text: string): void {
    // TTS playback will be implemented
  }
}

// Export singleton instance
export const audioService = new AudioService();
export default audioService;