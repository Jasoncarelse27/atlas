import { canUseAudio } from '@/config/featureAccess';
import { createChatError } from '../features/chat/lib/errorHandler';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';
import { getApiEndpoint } from '../utils/apiClient';
import { generateUUID } from "../utils/uuid";
import { fetchWithAuth } from '../utils/authFetch';

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
  private readonly STORAGE_BUCKET = 'voice-notes';
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly SUPPORTED_FORMATS = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/m4a'];

  /**
   * Record audio and transcribe it
   */
  async recordAndTranscribe(audioBlob: Blob, userTier?: 'free' | 'core' | 'studio'): Promise<string> {
    try {
      // ✅ TIER ENFORCEMENT: Use centralized tier config
      if (userTier && !canUseAudio(userTier)) {
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
      // Get current user for path structure
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('Authentication required');
      }

      // Generate unique filename with user ID prefix (required by RLS)
      const filename = `${session.user.id}/recording_${Date.now()}_${generateUUID()}.webm`;
      
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
      // ✅ BEST PRACTICE: Use centralized auth fetch utility (handles 401 automatically)
      const response = await fetchWithAuth(getApiEndpoint('/api/transcribe'), {
        method: 'POST',
        body: JSON.stringify({
          audioUrl,
          language: 'en', // Default to English, can be made configurable
        }),
        retryOn401: true, // ✅ CRITICAL: Auto-retry with refreshed token on 401
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
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Synthesize speech from text using OpenAI TTS
   * ✅ BEST PRACTICE: Uses centralized authFetch utility for consistent 401 handling
   */
  async synthesizeSpeech(text: string): Promise<string> {
    try {
      const apiEndpoint = getApiEndpoint('/api/synthesize');
      logger.debug('[VoiceService] Making TTS API call:', {
        endpoint: apiEndpoint,
        textLength: text.length
      });
      
      // ✅ CRITICAL FIX: Force token refresh before TTS request to prevent 401 errors
      // This ensures we always have a fresh, valid token
      const { getAuthTokenOrThrow } = await import('../utils/getAuthToken');
      let token: string;
      
      try {
        // Force refresh to get the latest token
        token = await getAuthTokenOrThrow('Authentication required for text-to-speech');
        logger.info('[VoiceService] ✅ Got fresh auth token for TTS request', {
          tokenLength: token.length,
          tokenPrefix: token.substring(0, 20) + '...',
          endpoint: apiEndpoint
        });
      } catch (authError) {
        logger.error('[VoiceService] ❌ Failed to get auth token:', authError);
        throw new Error('Authentication required - please sign in again');
      }
      
      // ✅ CRITICAL FIX: Use direct fetch with fresh token instead of fetchWithAuth
      // This ensures we use the freshly refreshed token and avoid 401 errors
      logger.info('[VoiceService] 📡 Making TTS request with token:', {
        endpoint: apiEndpoint,
        hasToken: !!token,
        tokenLength: token?.length || 0
      });
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      
      logger.info('[VoiceService] TTS API response status:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorData: any = {};
        
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Unknown error' };
        }
        
        // ✅ Enhanced error logging with full details
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          errorData,
          endpoint: apiEndpoint,
          hasToken: !!token,
          tokenLength: token?.length || 0,
          sessionExpired: response.status === 401
        };
        
        // ✅ CRITICAL FIX: If 401, try one more time with a fresh token refresh
        if (response.status === 401) {
          logger.warn('[VoiceService] ⚠️ Got 401, attempting one more refresh...');
          
          try {
            // Force a fresh refresh
            const { getAuthToken } = await import('../utils/getAuthToken');
            const refreshedToken = await getAuthToken(true);
            
            if (refreshedToken && refreshedToken !== token) {
              logger.debug('[VoiceService] ✅ Got new token, retrying TTS request...');
              
              // Retry with fresh token
              const retryResponse = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${refreshedToken}`,
                },
                body: JSON.stringify({ text }),
              });
              
              if (retryResponse.ok) {
                logger.debug('[VoiceService] ✅ Retry successful after token refresh');
                const result = await retryResponse.json();
                const audioDataUrl = `data:audio/mp3;base64,${result.audio}`;
                logger.debug(`✅ [VoiceService] Speech synthesized: ${result.size} bytes`);
                return audioDataUrl;
              } else {
                logger.error('[VoiceService] ❌ Retry still failed:', {
                  status: retryResponse.status,
                  statusText: retryResponse.statusText
                });
              }
            } else {
              logger.error('[VoiceService] ❌ Token refresh did not produce new token');
            }
          } catch (retryError) {
            logger.error('[VoiceService] ❌ Error during retry:', retryError);
          }
          
          logger.error('[VoiceService] Authentication failed (401):', errorDetails);
          throw new Error('Authentication failed - please sign in again');
        }
        
        // ✅ Silent fail for service unavailable (503) - don't spam console
        if (response.status === 503) {
          logger.debug('[VoiceService] TTS service unavailable (503) - silently failing');
          throw new Error('TTS_SERVICE_UNAVAILABLE'); // Special error code for silent handling
        }
        
        // Handle tier restriction errors
        if (response.status === 403 && errorData.upgradeRequired) {
          throw new Error('Text-to-speech requires Core or Studio tier. Please upgrade to continue.');
        }
        
        // Only log non-503 errors with full details
        if (response.status !== 503) {
          logger.error('[VoiceService] TTS API error:', errorDetails);
        }
        
        throw new Error(errorData.error || errorData.message || `Speech synthesis failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Convert base64 audio to data URL for playback
      const audioDataUrl = `data:audio/mp3;base64,${result.audio}`;
      
      logger.debug(`✅ [VoiceService] Speech synthesized: ${result.size} bytes`);
      
      return audioDataUrl;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'synthesizeSpeech',
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Play audio from data URL (mobile-friendly with user gesture handling)
   */
  async playAudio(audioDataUrl: string): Promise<void> {
    try {
      const audio = new Audio(audioDataUrl);
      
      // ✅ Mobile Fix: Preload audio to improve responsiveness
      audio.preload = 'auto';
      
      // ✅ Mobile Fix: Handle autoplay restrictions
      try {
        await audio.play();
      } catch (playError: unknown) {
        const error = playError as Error & { name?: string };
        // Handle autoplay blocking (common on mobile)
        if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
          logger.warn('[VoiceService] Autoplay blocked, user interaction required');
          
          // Create a user-friendly error message
          throw new Error('Audio playback requires user interaction. Please tap the Listen button again.');
        }
        throw playError;
      }
      
      return new Promise((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = (event) => {
          logger.error('[VoiceService] Audio playback error:', event);
          reject(new Error('Audio playback failed'));
        };
        
        // ✅ Mobile Fix: Add timeout to prevent hanging
        setTimeout(() => {
          if (!audio.ended) {
            reject(new Error('Audio playback timeout'));
          }
        }, 60000); // 60 second timeout
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
   * Upload audio without transcribing (for voice notes)
   * Returns audio metadata for preview and sending
   */
  async uploadAudioOnly(audioBlob: Blob, userTier?: 'free' | 'core' | 'studio'): Promise<AudioMetadata> {
    try {
      // ✅ TIER ENFORCEMENT: Use centralized tier config
      if (userTier && !canUseAudio(userTier)) {
        throw new Error('Voice notes require Core or Studio tier. Please upgrade to continue.');
      }

      // Validate audio file
      this.validateAudioFile(audioBlob);

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('Authentication required');
      }

      // Upload to voice-notes bucket
      const filename = `${session.user.id}/voice_${Date.now()}_${generateUUID()}.webm`;
      
      const { error } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .upload(filename, audioBlob, {
          contentType: audioBlob.type,
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.STORAGE_BUCKET)
        .getPublicUrl(filename);
      
      logger.debug(`✅ [VoiceNote] Uploaded: ${urlData.publicUrl}`);

      // Create metadata
      const metadata: AudioMetadata = {
        id: filename,
        url: urlData.publicUrl,
        duration: 0, // Will be set from audio element
        size: audioBlob.size,
        mimeType: audioBlob.type,
        uploadedAt: new Date().toISOString(),
      };
      
      return metadata;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'uploadAudioOnly',
        timestamp: new Date().toISOString()
      });
      throw chatError;
    }
  }

  /**
   * Record and upload voice note (does NOT transcribe, saves as audio file)
   * @deprecated Use uploadAudioOnly() instead
   */
  async recordVoiceNote(
    audioBlob: Blob, 
    userId: string, 
    conversationId: string
  ): Promise<string> {
    try {
      // Upload to voice-notes bucket
      const filename = `${userId}/${conversationId}_${Date.now()}.webm`;
      
      const { error } = await supabase.storage
        .from('voice-notes')
        .upload(filename, audioBlob, {
          contentType: audioBlob.type,
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('voice-notes')
        .getPublicUrl(filename);
      
      logger.debug(`✅ [VoiceNote] Uploaded: ${urlData.publicUrl}`);
      
      return urlData.publicUrl;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'recordVoiceNote',
        timestamp: new Date().toISOString()
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
