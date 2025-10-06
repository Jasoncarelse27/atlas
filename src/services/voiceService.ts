import { createChatError } from '../features/chat/lib/errorHandler';
import { supabase } from '../lib/supabase';
import { generateUUID } from "../utils/uuid";

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  language: string;
  duration: number;
}

export interface AudioMetadata {
  id: string;
  url: string;
  duration: number;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

class VoiceService {
  private readonly STORAGE_BUCKET = 'voice-recordings';
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly SUPPORTED_FORMATS = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/m4a'];

  /**
   * Record audio and transcribe it
   */
  async recordAndTranscribe(audioBlob: Blob, userTier?: 'free' | 'core' | 'studio'): Promise<string> {
    try {
      // 🎯 TIER ENFORCEMENT: Block free users from using audio
      if (userTier === 'free') {
        throw new Error('Audio transcription requires Core or Studio tier. Please upgrade to continue.');
      }

      // Validate audio file
      this.validateAudioFile(audioBlob);

      // Upload to Supabase Storage
      const audioMetadata = await this.uploadAudio(audioBlob);

      // Transcribe audio
      const transcription = await this.transcribeAudio(audioMetadata.url);

      return transcription.transcript;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'recordAndTranscribe',
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Upload audio file to Supabase Storage
   */
  async uploadAudio(audioBlob: Blob): Promise<AudioMetadata> {
    try {
      // Generate unique filename
      const filename = `recording_${Date.now()}_${generateUUID()}.webm`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .upload(filename, audioBlob, {
          contentType: audioBlob.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.STORAGE_BUCKET)
        .getPublicUrl(filename);

      // Create metadata
      const metadata: AudioMetadata = {
        id: data.path,
        url: urlData.publicUrl,
        duration: 0, // Will be updated after transcription
        size: audioBlob.size,
        mimeType: audioBlob.type,
        uploadedAt: new Date().toISOString(),
      };

      return metadata;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'uploadAudio',
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Transcribe audio file using backend API
   */
  async transcribeAudio(audioUrl: string): Promise<TranscriptionResult> {
    try {
      // Get JWT token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          audioUrl,
          language: 'en', // Default to English, can be made configurable
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle tier restriction errors
        if (response.status === 403 && errorData.upgradeRequired) {
          throw new Error('Audio transcription requires Core or Studio tier. Please upgrade to continue.');
        }
        
        throw new Error(errorData.error || `Transcription failed: ${response.statusText}`);
      }

      const result: TranscriptionResult = await response.json();
      return result;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'transcribeAudio',
        audioUrl,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Synthesize speech from text using ElevenLabs
   */
  async synthesizeSpeech(text: string, voiceId: string = 'Rachel'): Promise<string> {
    try {
      // Get JWT token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Authentication required');
      }

      console.log(`🔊 [VoiceService] Synthesizing speech for: "${text.slice(0, 50)}..."`);

      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          text,
          voiceId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle tier restriction errors
        if (response.status === 403 && errorData.upgradeRequired) {
          throw new Error('Text-to-speech requires Core or Studio tier. Please upgrade to continue.');
        }
        
        throw new Error(errorData.error || `Speech synthesis failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Convert base64 audio to data URL for playback
      const audioDataUrl = `data:audio/mp3;base64,${result.audio}`;
      
      console.log(`✅ [VoiceService] Speech synthesized: ${result.size} bytes`);
      
      return audioDataUrl;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'synthesizeSpeech',
        text: text.slice(0, 100),
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Play audio from data URL
   */
  async playAudio(audioDataUrl: string): Promise<void> {
    try {
      const audio = new Audio(audioDataUrl);
      await audio.play();
      
      return new Promise((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = (err) => reject(new Error('Audio playback failed'));
      });
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'playAudio',
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Get transcription history for a user
   */
  async getTranscriptionHistory(userId: string, limit: number = 50): Promise<TranscriptionResult[]> {
    try {
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getTranscriptionHistory',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Delete audio file and transcription
   */
  async deleteAudio(audioId: string): Promise<void> {
    try {
      // Delete from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .remove([audioId]);

      if (storageError) throw storageError;

      // Delete transcription record from database
      const { error: dbError } = await supabase
        .from('transcriptions')
        .delete()
        .eq('audio_id', audioId);

      if (dbError) throw dbError;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'deleteAudio',
        audioId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Validate audio file before upload
   */
  private validateAudioFile(audioBlob: Blob): void {
    // Check file size
    if (audioBlob.size > this.MAX_FILE_SIZE) {
      throw new Error(`Audio file too large. Maximum size is ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Check file format
    if (!this.SUPPORTED_FORMATS.includes(audioBlob.type)) {
      throw new Error(`Unsupported audio format. Supported formats: ${this.SUPPORTED_FORMATS.join(', ')}`);
    }

    // Check if blob is empty
    if (audioBlob.size === 0) {
      throw new Error('Audio file is empty');
    }
  }

  /**
   * Get supported audio formats
   */
  getSupportedFormats(): string[] {
    return [...this.SUPPORTED_FORMATS];
  }

  /**
   * Get maximum file size
   */
  getMaxFileSize(): number {
    return this.MAX_FILE_SIZE;
  }

  /**
   * Check if audio format is supported
   */
  isFormatSupported(mimeType: string): boolean {
    return this.SUPPORTED_FORMATS.includes(mimeType);
  }

  /**
   * Get storage bucket name
   */
  getStorageBucket(): string {
    return this.STORAGE_BUCKET;
  }
}

export const voiceService = new VoiceService();
export default voiceService;
