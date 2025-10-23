// Audio helpers for cross-platform compatibility
import { logger } from '@/lib/logger';

/**
 * Safely get user media with iOS Safari compatibility
 */
export async function getSafeUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  // Check if we're in a secure context (HTTPS or localhost)
  const isSecureContext = window.isSecureContext;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (!isSecureContext && !isLocalhost) {
    logger.warn('[Audio] Insecure context detected. Voice features require HTTPS.');
    // For development on local network, we'll try anyway but warn
    if (window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.')) {
      logger.warn('[Audio] Local network detected. Voice may not work on iOS Safari without HTTPS.');
    }
  }
  
  // Check if API exists
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    // Fallback for older browsers
    const getUserMedia = navigator.getUserMedia || 
                        (navigator as any).webkitGetUserMedia || 
                        (navigator as any).mozGetUserMedia || 
                        (navigator as any).msGetUserMedia;
    
    if (!getUserMedia) {
      throw new Error('Your browser does not support audio recording. Please use Chrome, Firefox, or Safari on desktop.');
    }
    
    // Use legacy API
    return new Promise((resolve, reject) => {
      getUserMedia.call(navigator, constraints, resolve, reject);
    });
  }
  
  // Modern API with iOS-specific handling
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
          autoGainControl: false,   // ✅ Disable auto gain control (THIS WAS RESETTING YOUR VOLUME!)
          sampleRate: 48000,        // 48kHz for high quality
          channelCount: 1           // Mono for voice
        }
      };
      return await navigator.mediaDevices.getUserMedia(enhancedConstraints);
    }
    
    // If caller provided detailed audio constraints, use them as-is
    return await navigator.mediaDevices.getUserMedia(constraints);
    
  } catch (error: any) {
    logger.error('[Audio] getUserMedia error:', error);
    
    // Provide helpful error messages
    if (error.name === 'NotAllowedError') {
      throw new Error('Microphone access denied. Please allow microphone permissions in your browser settings.');
    } else if (error.name === 'NotFoundError') {
      throw new Error('No microphone found. Please connect a microphone and try again.');
    } else if (error.name === 'NotReadableError') {
      throw new Error('Microphone is already in use by another application.');
    } else if (error.name === 'SecurityError') {
      throw new Error('Voice features require a secure connection (HTTPS). Please use the desktop app or access via HTTPS.');
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
