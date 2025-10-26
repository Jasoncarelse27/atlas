// Audio helpers for cross-platform compatibility
import { logger } from '@/lib/logger';

/**
 * Safely get user media with iOS Safari compatibility
 */
export async function getSafeUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  // Check if getUserMedia API exists (iOS Safari hides it on HTTP)
  if (!navigator.mediaDevices?.getUserMedia) {
    // If we're not on HTTPS or localhost, assume it's an HTTPS requirement issue
    const isSecure = window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1';
    
    if (!isSecure) {
      // Most likely iOS Safari on HTTP, or any browser with strict security
      throw new Error('Voice features require a secure connection (HTTPS). Please use the desktop app or access via HTTPS.');
    }
    
    // If we ARE on HTTPS but getUserMedia is missing, it's truly unsupported
    throw new Error('Your browser does not support audio recording. Please use Chrome, Firefox, or Safari.');
  }

  // Modern API - just try it and handle errors gracefully
  try {
    // For iOS Safari, we need specific constraints
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (isIOS && isSafari) {
      logger.info('[Audio] iOS Safari detected, using optimized constraints');
      // iOS Safari specific constraints
      const iosConstraints = {
        audio: {
          echoCancellation: false, // iOS handles this natively
          noiseSuppression: false, // iOS handles this natively
          autoGainControl: false,  // iOS handles this natively
          sampleRate: 48000        // iOS prefers 48kHz
        }
      };
      return await navigator.mediaDevices.getUserMedia(iosConstraints);
    }
    
    // ✅ FIX: Standard constraints for other browsers (disable aggressive processing)
    if (constraints.audio === true) {
      // If caller just passed { audio: true }, add detailed constraints
      const enhancedConstraints = {
        audio: {
          echoCancellation: false,  // ✅ Disable echo cancellation
          noiseSuppression: false,  // ✅ Disable noise suppression
          autoGainControl: false,   // ✅ Disable auto gain control
          sampleRate: 48000,        // 48kHz for high quality
          channelCount: 1           // Mono for voice
        }
      };
      return await navigator.mediaDevices.getUserMedia(enhancedConstraints);
    }
    
    // If caller provided detailed audio constraints, use them as-is
    return await navigator.mediaDevices.getUserMedia(constraints);
    
  } catch (error: unknown) {
    logger.error('[Audio] getUserMedia error:', error);
    
    // Provide helpful error messages based on error type
    if (error.name === 'NotAllowedError') {
      throw new Error('Microphone access denied. Please allow microphone permissions in your browser settings.');
    } else if (error.name === 'NotFoundError') {
      throw new Error('No microphone found. Please connect a microphone and try again.');
    } else if (error.name === 'NotReadableError') {
      throw new Error('Microphone is already in use by another application.');
    } else if (error.name === 'SecurityError') {
      // This is the HTTPS requirement error on iOS
      throw new Error('Voice features require a secure connection (HTTPS). Please use the desktop app or access via HTTPS.');
    } else if (error.name === 'NotSupportedError') {
      throw new Error('Your browser does not support audio recording. Please use Chrome, Firefox, or Safari.');
    }
    
    throw error;
  }
}

/**
 * Check if audio recording is supported
 * 
 * ✅ FIX: Removed secure context check - we handle HTTPS requirements separately
 * in VoiceCallModal with proper user guidance. This function now only checks for
 * API availability, letting the actual getUserMedia() call handle security errors.
 */
export function isAudioRecordingSupported(): boolean {
  // Check for required APIs
  const hasGetUserMedia = !!(
    navigator.mediaDevices?.getUserMedia ||
    navigator.getUserMedia ||
    (navigator as any).webkitGetUserMedia ||
    (navigator as any).mozGetUserMedia
  );
  
  // ✅ FIX: MediaRecorder check removed for iOS compatibility
  // iOS Safari added MediaRecorder in v14.3, but we can still get audio
  // through getUserMedia and handle recording differently if needed
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  if (isIOS) {
    // For iOS, only check getUserMedia - we'll handle recording errors gracefully later
    logger.info('[Audio] iOS detected, checking getUserMedia only');
    return hasGetUserMedia;
  }
  
  // For desktop/Android, check both APIs
  const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
  
  logger.info('[Audio] Audio recording support check:', {
    hasGetUserMedia,
    hasMediaRecorder,
    isIOS,
    userAgent: navigator.userAgent
  });
  
  return hasGetUserMedia && hasMediaRecorder;
}

/**
 * Get supported MIME type for MediaRecorder
 */
export function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/wav'
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      logger.debug(`[Audio] Using MIME type: ${type}`);
      return type;
    }
  }
  
  // Fallback - let browser choose
  logger.warn('[Audio] No supported MIME type found, using default');
  return '';
}
