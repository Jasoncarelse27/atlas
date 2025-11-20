// 🎙️ Voice Call Modal - Studio Tier Exclusive Feature
// Real-time voice conversation with Atlas AI

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Copy, Mic, MicOff, Phone, PhoneOff, Settings, Volume2, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { canUseVoiceEmotion, tierFeatures, isVoiceCallComingSoon } from '../../config/featureAccess';
import { modernToast } from '../../config/toastConfig';
import { useUpgradeModals } from '../../contexts/UpgradeModalContext';
import { useFeatureAccess } from '../../hooks/useTierAccess';
import { logger } from '../../lib/logger';
import { unifiedVoiceCallService } from '../../services/unifiedVoiceCallService';
import { voiceCallState } from '../../services/voiceCallState';
import { getSafeUserMedia } from '../../utils/audioHelpers';
import { isFeatureEnabled } from '../../config/featureFlags';
import { MicrophoneHelpModal } from '../MicrophoneHelpModal';

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  conversationId: string;
}

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  isOpen,
  onClose,
  userId,
  conversationId,
}) => {
  const { canUse, tier } = useFeatureAccess('voice');
  const { showVoiceUpgrade } = useUpgradeModals();
  
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(false); // 🎙️ ChatGPT-style push-to-talk
  const [isSpacePressed, setIsSpacePressed] = useState(false); // Track space key
  const [callDuration, setCallDuration] = useState(0);
  const [isEndingCall, setIsEndingCall] = useState(false); // ✅ Prevent double-click on end call
  const [audioLevel, setAudioLevel] = useState(0);
  const [callStatus, setCallStatus] = useState<'listening' | 'transcribing' | 'thinking' | 'speaking' | 'reconnecting'>('listening');
  const [lastTranscript, setLastTranscript] = useState<string>('');
  const [lastAIResponse, setLastAIResponse] = useState<string>('');
  const [micLevel, setMicLevel] = useState(0); // 0-100 for visual feedback
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'poor' | 'offline'>('excellent');
  const transcriptRef = useRef<HTMLDivElement>(null);
  
  // Permission states
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showHTTPSWarning, setShowHTTPSWarning] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null); // For MicrophoneHelpModal
  
  const callStartTime = useRef<Date | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const microphone = useRef<MediaStreamAudioSourceNode | null>(null);
  const stream = useRef<MediaStream | null>(null);

  // Audio level monitoring
  const monitorAudioLevel = useCallback(() => {
    if (!analyser.current) return;
    
    const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
    analyser.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedLevel = average / 255; // 0-1
    setAudioLevel(normalizedLevel);
    
    // Set mic level for visual indicator (0-100)
    setMicLevel(Math.round(normalizedLevel * 100));
    
    if (isCallActive) {
      requestAnimationFrame(monitorAudioLevel);
    }
  }, [isCallActive]);

  // Auto-scroll transcript to bottom when new content arrives (Phase 1 Improvement)
  useEffect(() => {
    if (transcriptRef.current && (lastTranscript || lastAIResponse)) {
      transcriptRef.current.scrollTo({
        top: transcriptRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [lastTranscript, lastAIResponse]);

  // Check microphone permission status
  const checkPermissionStatus = useCallback(async (): Promise<(() => void) | null> => {
    try {
      // Check if Permissions API is supported
      if (!navigator.permissions || !navigator.permissions.query) {
        logger.debug('[VoiceCall] Permissions API not supported, will request directly');
        setPermissionState('prompt');
        return null;
      }

      // Query microphone permission
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setPermissionState(result.state as 'prompt' | 'granted' | 'denied');
      logger.debug('[VoiceCall] Permission state:', result.state);

      // ✅ FIX: Listen for permission changes with proper cleanup
      const handlePermissionChange = () => {
        setPermissionState(result.state as 'prompt' | 'granted' | 'denied');
        logger.debug('[VoiceCall] Permission state changed:', result.state);
      };
      
      result.addEventListener('change', handlePermissionChange);
      
      // Return cleanup function
      return () => result.removeEventListener('change', handlePermissionChange);
    } catch (error) {
      logger.error('[VoiceCall] Permission check failed:', error);
      // Fallback: assume prompt state
      setPermissionState('prompt');
      return null;
    }
  }, []);

  // Check permission on mount and when modal opens
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    
    if (isOpen && !isCallActive) {
      checkPermissionStatus().then(fn => {
        cleanup = fn;
      });
    }
    
    // ✅ FIX: Cleanup permission listener on unmount
    return () => {
      if (cleanup) cleanup();
    };
  }, [isOpen, isCallActive, checkPermissionStatus]);

  // Detect browser and platform for recovery instructions
  const getPlatformInstructions = (): { platform: string; steps: string[] } => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    const isChrome = /chrome/.test(userAgent);
    const isFirefox = /firefox/.test(userAgent);

    if (isIOS || isSafari) {
      return {
        platform: 'iOS Safari',
        steps: [
          'Open Settings app',
          'Scroll to Safari → Website Settings',
          'Find Microphone and set to "Allow"',
          'Reload this page and try again'
        ]
      };
    } else if (isChrome) {
      return {
        platform: 'Chrome',
        steps: [
          'Click the lock icon in address bar',
          'Go to Site Settings',
          'Find Microphone and set to "Allow"',
          'Reload and try again'
        ]
      };
    } else if (isFirefox) {
      return {
        platform: 'Firefox',
        steps: [
          'Click the shield icon in address bar',
          'Go to Permissions',
          'Find Microphone and set to "Allow"',
          'Reload and try again'
        ]
      };
    }

    return {
      platform: 'Your Browser',
      steps: [
        'Check browser settings',
        'Look for Site Permissions',
        'Enable Microphone access',
        'Reload and try again'
      ]
    };
  };

  // Start voice call
  const startCall = async () => {
    try {
      // ✅ SOFT LAUNCH: Check if voice calls are coming soon
      if (isVoiceCallComingSoon()) {
        modernToast.info('🎙️ Voice Calls Coming Soon', 'This feature will be available soon!', {
          duration: 4000,
          icon: '🔜',
        });
        onClose();
        return;
      }

      // Check tier access using centralized hook
      if (!canUse) {
        onClose();
        showVoiceUpgrade();
        return;
      }

      // ✅ Phase 2: Check HTTPS requirement for mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isLocalNetwork = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(window.location.hostname);
      const isHTTPS = window.location.protocol === 'https:';
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      if (isMobile && isLocalNetwork && !isHTTPS && !isLocalhost) {
        logger.warn('[VoiceCall] HTTPS required for mobile on local network');
        setShowHTTPSWarning(true);
        return;
      }

      // ✅ Phase 1: Check permission status
      if (permissionState === 'denied') {
        logger.warn('[VoiceCall] Permission denied, showing recovery modal');
        setShowRecoveryModal(true);
        return;
      }

      if (permissionState === 'prompt' || permissionState === 'checking') {
        logger.debug('[VoiceCall] Showing permission context modal');
        setShowPermissionModal(true);
        return;
      }

      // Permission is granted, proceed with call
      await proceedWithCall();
    } catch (error) {
      logger.error('[VoiceCall] Failed to start:', error);
      modernToast.error('Failed to start voice call', 'Please try again');
      setIsCallActive(false);
    }
  };

  // Proceed with actual call setup (after permission granted)
  const proceedWithCall = async () => {
    try {
      // Get max duration (-1 = unlimited for Studio)
      const maxDuration = (tierFeatures[tier] as any).voiceCallMaxDuration;
      logger.debug('[VoiceCall] Max duration:', maxDuration);

      setIsCallActive(true);
      voiceCallState.setActive(true); // 🚀 Disable heavy operations
      callStartTime.current = new Date();
      
      // Start duration timer
      durationInterval.current = setInterval(() => {
        if (callStartTime.current) {
          const seconds = Math.floor((Date.now() - callStartTime.current.getTime()) / 1000);
          setCallDuration(seconds);
        }
      }, 1000);

      // Initialize audio monitoring with iOS compatibility
      try {
        // ✅ BYPASS: Skip the broken isAudioRecordingSupported check
        // Let getUserMedia itself determine support and show proper errors
        audioContext.current = new AudioContext();
        stream.current = await getSafeUserMedia({ audio: true });
        
        // ✅ CRITICAL FIX: Ensure microphone tracks are enabled and not muted
        const audioTracks = stream.current.getAudioTracks();
        for (const track of audioTracks) {
          if (!track.enabled) {
            logger.warn('[VoiceCall] Enabling disabled microphone track');
            track.enabled = true;
          }
          
          // ✅ IMPROVEMENT: Warn if muted but don't block - let voiceCallService test actual audio
          // Sometimes macOS shows muted but audio still works (false positive)
          if (track.muted) {
            logger.warn('[VoiceCall] ⚠️ Track reports muted - will test actual audio levels in service');
            logger.debug('[VoiceCall] Track diagnostic:', {
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState,
              label: track.label,
            });
            // Don't block here - let voiceCallService.ts test actual audio levels
            // It will detect if audio is truly muted or just a false flag
          }
        }
        
        // ✅ CRITICAL: Verify we have audio tracks
        const finalTracks = stream.current.getAudioTracks();
        if (finalTracks.length === 0) {
          logger.error('[VoiceCall] ❌ No audio tracks available');
          setIsCallActive(false);
          voiceCallState.setActive(false);
          modernToast.error('No Microphone Found', 'Please connect a microphone and try again');
          return;
        }
        
        // ✅ IMPROVEMENT: Don't block on muted flag here - let voiceCallService test actual audio
        // The service will test audio levels for 1 second and detect if truly muted
        if (finalTracks[0].muted) {
          logger.warn('[VoiceCall] ⚠️ Track reports muted - service will test actual audio levels');
        }
        
        microphone.current = audioContext.current.createMediaStreamSource(stream.current);
        analyser.current = audioContext.current.createAnalyser();
        analyser.current.fftSize = 256;
        
        microphone.current.connect(analyser.current);
        monitorAudioLevel();
      } catch (audioError: any) {
        logger.error('[VoiceCall] Audio setup failed:', audioError);
        setIsCallActive(false);
        
        // Check if this is an HTTPS requirement error
        if (audioError instanceof Error && audioError.message.includes('secure connection (HTTPS)')) {
          setShowHTTPSWarning(true);
          return;
        }
        
        // ✅ ENHANCED: Catch NotAllowedError and SecurityError specifically
        const isPermissionError = audioError?.name === 'NotAllowedError' || 
                                  audioError?.name === 'SecurityError' ||
                                  (audioError instanceof Error && 
                                   (audioError.message.includes('Permission denied') || 
                                    audioError.message.includes('Microphone access denied') ||
                                    audioError.message.includes('not allowed')));
        
        if (isPermissionError) {
          logger.warn('[VoiceCall] Permission error detected:', audioError?.name || 'Permission denied');
          setPermissionError(audioError?.name || 'denied');
          modernToast.error('Microphone access denied', 'Check your browser settings to enable microphone');
          setShowRecoveryModal(true);
          return;
        }
        
        // Generic error
        modernToast.error('Failed to access microphone', audioError instanceof Error ? audioError.message : 'Unknown error');
        return;
      }

      // Start voice call service (unified - supports V1 and V2)
      try {
        const isV2 = isFeatureEnabled('VOICE_V2');
        logger.info(`[VoiceCall] Starting call with ${isV2 ? 'V2 (WebSocket)' : 'V1 (REST)'}`);
        
        await unifiedVoiceCallService.startCall({
          userId,
          conversationId,
          tier: tier as 'studio',
          onTranscript: (text: string) => {
            logger.debug('[VoiceCall] User said:', text);
            setLastTranscript(text);
          },
          onAIResponse: (text: string) => {
            logger.debug('[VoiceCall] Atlas said:', text);
            setLastAIResponse(text);
          },
          onError: (error: Error) => {
            logger.error('[VoiceCall] Service error:', error);
            
            // ✅ IMPROVED: Better error messages for microphone issues
            let friendlyMessage: string;
            let friendlyDescription: string;
            
            if (error.message.includes('Microphone is muted at system level')) {
              friendlyMessage = 'Microphone Muted';
              friendlyDescription = 'Unmute your microphone (F10 or Control Center) and try again';
              modernToast.error(friendlyMessage, friendlyDescription);
              setIsCallActive(false);
              voiceCallState.setActive(false);
              // ✅ CRITICAL FIX: Ensure cleanup even if call never fully started
              endCall().catch(err => logger.error('[VoiceCall] Error during error cleanup:', err));
              return;
            } else if (error.message.includes('Microphone') && error.message.includes('muted')) {
              friendlyMessage = 'Microphone Muted';
              friendlyDescription = 'Check your system settings and unmute your microphone';
              modernToast.error(friendlyMessage, friendlyDescription);
              setIsCallActive(false);
              voiceCallState.setActive(false);
              // ✅ CRITICAL FIX: Ensure cleanup even if call never fully started
              endCall().catch(err => logger.error('[VoiceCall] Error during error cleanup:', err));
              return;
            } else if (error.message.includes('Microphone')) {
              friendlyMessage = 'Microphone not available';
              friendlyDescription = 'Please check your microphone connection';
            } else if (error.message.includes('Connection lost')) {
              friendlyMessage = 'Connection lost';
              friendlyDescription = 'Retrying...';
            } else if (error.message.includes('WebSocket')) {
              friendlyMessage = 'Connection issue';
              friendlyDescription = 'Retrying...';
            } else {
              friendlyMessage = error.message.split('\n')[0]; // First line only
              friendlyDescription = error.message.includes('\n') ? error.message.split('\n').slice(1).join(' ') : '';
            }
            
            // ✅ FIX: Don't auto-end call for recoverable errors
            // Only end for critical errors (permission denied, etc.)
            const isCriticalError = 
              error.message.includes('Permission denied') ||
              error.message.includes('Microphone access denied') ||
              error.message.includes('Maximum call duration') ||
              error.message.includes('Authentication failed') ||
              error.message.includes('WebSocket connection') ||
              error.message.includes('connection timeout');
            
            if (isCriticalError) {
            modernToast.error(friendlyMessage);
            // ✅ CRITICAL FIX: Always cleanup on critical errors, even if call didn't fully start
            endCall().catch(err => logger.error('[VoiceCall] Error during critical error cleanup:', err));
            } else {
              // Non-critical errors - show warning but keep call active
              modernToast.warning('Voice call issue', friendlyMessage);
              logger.warn('[VoiceCall] Non-critical error, keeping call active:', error.message);
            }
          },
          onStatusChange: (status) => {
            setCallStatus(status);
            // ✅ IMPROVEMENT: Update network quality from service (V1 only)
            if (!isV2) {
              const quality = unifiedVoiceCallService.getNetworkQuality();
              setNetworkQuality(quality);
            } else {
              // V2 handles network quality internally via WebSocket
              setNetworkQuality('excellent'); // Assume good for WebSocket
            }
          },
          onAudioLevel: (level: number) => {
            // ✅ CHATGPT-STYLE: Real-time audio level from VAD (V1 only)
            // V2 handles audio level internally
            if (!isV2) {
            setAudioLevel(level);
            setMicLevel(Math.round(level * 100));
            }
          },
        });
        
        // ✅ IMPROVEMENT: Poll network quality every 3 seconds for UI updates (V1 only)
        if (!isV2) {
          const networkQualityInterval = setInterval(() => {
            if (isCallActive) {
              const quality = unifiedVoiceCallService.getNetworkQuality();
              setNetworkQuality(quality);
            } else {
              clearInterval(networkQualityInterval);
            }
          }, 3000);
          
          // Store interval for cleanup
          (window as any).__atlasNetworkQualityInterval = networkQualityInterval;
        }
        
        modernToast.success('Voice call started!');
      } catch (serviceError) {
        logger.error('[VoiceCall] Service failed to start:', serviceError);
        // ✅ CRITICAL FIX: If service fails to start, ensure cleanup happens
        setIsCallActive(false);
        voiceCallState.setActive(false);
        
        // ✅ CRITICAL FIX: Clean up any partial resources (recording, streams, etc.)
        try {
          // Stop any active audio tracks
          if (stream.current) {
            stream.current.getTracks().forEach(track => {
              try {
                track.stop();
                logger.debug('[VoiceCall] ✅ Stopped audio track after failed start');
              } catch (trackError) {
                logger.warn('[VoiceCall] Failed to stop track after failed start:', trackError);
              }
            });
            stream.current = null;
          }
          
          // Close AudioContext if opened
          if (audioContext.current && audioContext.current.state !== 'closed') {
            await audioContext.current.close();
            audioContext.current = null;
            logger.debug('[VoiceCall] ✅ Closed AudioContext after failed start');
          }
        } catch (cleanupError) {
          logger.error('[VoiceCall] Error cleaning up after failed start:', cleanupError);
        }
        
        // Try to stop the service (may not be initialized, but try anyway)
        try {
          await unifiedVoiceCallService.stopCall(userId);
        } catch (stopError) {
          logger.debug('[VoiceCall] Service stop failed (may not have started):', stopError);
        }
        
        modernToast.error('Failed to start voice call', serviceError instanceof Error ? serviceError.message : 'Unknown error');
      }
    } catch (error) {
      logger.error('[VoiceCall] Failed to proceed with call:', error);
      modernToast.error('Failed to start voice call');
      setIsCallActive(false);
      voiceCallState.setActive(false);
      
      // ✅ CRITICAL FIX: Clean up any partial resources
      try {
        if (stream.current) {
          stream.current.getTracks().forEach(track => {
            try {
              track.stop();
            } catch (trackError) {
              logger.warn('[VoiceCall] Failed to stop track:', trackError);
            }
          });
          stream.current = null;
        }
        
        if (audioContext.current && audioContext.current.state !== 'closed') {
          await audioContext.current.close();
          audioContext.current = null;
        }
      } catch (cleanupError) {
        logger.error('[VoiceCall] Error cleaning up:', cleanupError);
      }
    }
  };

  // End voice call - ✅ BEST PRACTICE: Comprehensive cleanup with error handling
  const endCall = useCallback(async () => {
    // ✅ IMPROVEMENT: Clear network quality polling interval
    if ((window as any).__atlasNetworkQualityInterval) {
      clearInterval((window as any).__atlasNetworkQualityInterval);
      delete (window as any).__atlasNetworkQualityInterval;
    }
    
    // ✅ BEST PRACTICE: Prevent double-click/double-call
    if (isEndingCall) {
      logger.debug('[VoiceCall] End call already in progress, ignoring duplicate call');
      return;
    }

    setIsEndingCall(true);
    logger.info('[VoiceCall] 🛑 Ending call...');

    try {
      // ✅ BEST PRACTICE: Stop service first (handles backend cleanup)
      try {
        await unifiedVoiceCallService.stopCall(userId);
        logger.debug('[VoiceCall] ✅ Service stopped successfully');
      } catch (serviceError) {
        logger.error('[VoiceCall] Failed to stop service:', serviceError);
        // Continue cleanup anyway - don't leave resources hanging
    }
    
      // ✅ BEST PRACTICE: Cleanup audio resources (even if service failed)
      try {
    if (stream.current) {
          stream.current.getTracks().forEach(track => {
            try {
              track.stop();
              logger.debug('[VoiceCall] ✅ Stopped audio track');
            } catch (trackError) {
              logger.warn('[VoiceCall] Failed to stop track:', trackError);
            }
          });
      stream.current = null;
    }
      } catch (streamError) {
        logger.error('[VoiceCall] Error cleaning up stream:', streamError);
      }

      // ✅ BEST PRACTICE: Cleanup AudioContext
      try {
    if (audioContext.current && audioContext.current.state !== 'closed') {
      await audioContext.current.close();
          logger.debug('[VoiceCall] ✅ AudioContext closed');
      audioContext.current = null;
    }
      } catch (contextError) {
        logger.error('[VoiceCall] Error closing AudioContext:', contextError);
      }

      // ✅ BEST PRACTICE: Cleanup intervals
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
        logger.debug('[VoiceCall] ✅ Duration interval cleared');
    }
    
      // ✅ BEST PRACTICE: Reset state
    setIsCallActive(false);
    voiceCallState.setActive(false); // 🚀 Re-enable background operations
    setCallDuration(0);
    callStartTime.current = null;
      setIsMuted(false); // Reset mute state
    
      // ✅ BEST PRACTICE: User feedback
    modernToast.success('Voice call ended');
      
      // ✅ BEST PRACTICE: Close modal after cleanup
    onClose();
      
      logger.info('[VoiceCall] ✅ Call ended successfully');
    } catch (error) {
      logger.error('[VoiceCall] Critical error during call end:', error);
      // ✅ BEST PRACTICE: Still try to cleanup even on error
      setIsCallActive(false);
      voiceCallState.setActive(false);
      modernToast.error('Error ending call', 'Some resources may not be cleaned up');
      onClose();
    } finally {
      // ✅ BEST PRACTICE: Always reset ending state
      setIsEndingCall(false);
    }
  }, [userId, isEndingCall, onClose]);

  // Toggle mute - ✅ BEST PRACTICE: Comprehensive error handling and user feedback
  const toggleMute = useCallback(() => {
    try {
      // ✅ BEST PRACTICE: Check stream exists
      if (!stream.current) {
        logger.warn('[VoiceCall] Cannot toggle mute - stream not available');
        modernToast.warning('Microphone not available', 'Please restart the call');
        return;
      }

      // ✅ BEST PRACTICE: Get audio track safely
      const audioTracks = stream.current.getAudioTracks();
      if (audioTracks.length === 0) {
        logger.warn('[VoiceCall] Cannot toggle mute - no audio tracks');
        modernToast.warning('Microphone track not found', 'Please restart the call');
        return;
      }

      const audioTrack = audioTracks[0];
      
      // ✅ BEST PRACTICE: Toggle enabled state
      const newMutedState = !audioTrack.enabled;
      audioTrack.enabled = newMutedState;
      
      // ✅ BEST PRACTICE: Update state based on actual track state (not stale)
      setIsMuted(newMutedState);
      
      // ✅ FIX: Sync voiceCallService mute state with actual track state (so VADService respects it)
      if (isCallActive) {
        unifiedVoiceCallService.toggleMute(newMutedState).catch(err => {
          logger.warn('[VoiceCall] Failed to update service mute state:', err);
        });
      }
      
      // ✅ BEST PRACTICE: User feedback
      if (newMutedState) {
        modernToast.info('Microphone muted');
        logger.debug('[VoiceCall] 🎤 Microphone muted');
      } else {
        modernToast.info('Microphone unmuted');
        logger.debug('[VoiceCall] 🎤 Microphone unmuted');
      }
      
      // ✅ BEST PRACTICE: Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } catch (error) {
      logger.error('[VoiceCall] Failed to toggle mute:', error);
      modernToast.error('Failed to toggle mute', 'Please try again');
    }
  }, []);

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup without triggering endCall (causes React warnings)
      if (stream.current) {
        stream.current.getTracks().forEach(track => track.stop());
      }
      if (audioContext.current && audioContext.current.state !== 'closed') {
        audioContext.current.close().catch(err => 
          logger.error('[VoiceCall] Cleanup error:', err)
        );
      }
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, []);

  // 🎙️ ChatGPT-Style Push-to-Talk Mode
  const togglePushToTalk = () => {
    setIsPushToTalk(!isPushToTalk);
    if (!isPushToTalk) {
      modernToast.success('Push-to-talk enabled!', 'Hold Space to speak');
      // Mute immediately when enabling PTT
      if (stream.current && !isMuted) {
        const audioTrack = stream.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = false;
          setIsMuted(true);
          // ✅ FIX: Sync service mute state
          if (isCallActive) {
            unifiedVoiceCallService.toggleMute(true).catch(err => {
              logger.warn('[VoiceCall] Failed to sync mute state:', err);
            });
          }
        }
      }
    } else {
      modernToast.success('Push-to-talk disabled');
      // Unmute when disabling PTT
      if (stream.current && isMuted) {
        const audioTrack = stream.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = true;
          setIsMuted(false);
          // ✅ FIX: Sync service mute state
          if (isCallActive) {
            unifiedVoiceCallService.toggleMute(false).catch(err => {
              logger.warn('[VoiceCall] Failed to sync mute state:', err);
            });
          }
        }
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      // Space = toggle mute OR push-to-talk
      if (e.code === 'Space' && isCallActive && !e.repeat) {
        e.preventDefault();
        
        if (isPushToTalk) {
          // Push-to-talk: Space down = unmute
          if (!isSpacePressed) {
            setIsSpacePressed(true);
            if (stream.current) {
              const audioTrack = stream.current.getAudioTracks()[0];
              if (audioTrack) {
                audioTrack.enabled = true;
                setIsMuted(false);
                // ✅ FIX: Sync service mute state
                if (isCallActive) {
                  unifiedVoiceCallService.toggleMute(false).catch(err => {
                    logger.warn('[VoiceCall] Failed to sync mute state:', err);
                  });
                }
              }
            }
          }
        } else {
          // Normal mode: Space = toggle mute
          toggleMute();
        }
      }
      // Escape = end call or close modal
      if (e.code === 'Escape') {
        e.preventDefault();
        if (isCallActive) {
          endCall();
        } else {
          onClose();
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // Space up = mute in push-to-talk mode
      if (e.code === 'Space' && isCallActive && isPushToTalk) {
        e.preventDefault();
        setIsSpacePressed(false);
        if (stream.current) {
          const audioTrack = stream.current.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = false;
            setIsMuted(true);
            // ✅ FIX: Sync service mute state
            if (isCallActive) {
              unifiedVoiceCallService.toggleMute(true).catch(err => {
                logger.warn('[VoiceCall] Failed to sync mute state:', err);
              });
            }
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, isCallActive, isPushToTalk, isSpacePressed]);

  // Handle permission modal - Request permission
  const handleRequestPermission = async () => {
    setShowPermissionModal(false);
    try {
      await proceedWithCall();
      setPermissionState('granted');
    } catch (error) {
      logger.error('[VoiceCall] Permission request failed:', error);
      setPermissionState('denied');
      setShowRecoveryModal(true);
    }
  };

  // Handle recovery modal - Retry permission check
  const handleRetryPermission = async () => {
    setShowRecoveryModal(false);
    await checkPermissionStatus();
    
    // If permission is still denied, show recovery again
    setTimeout(() => {
      if (permissionState === 'denied') {
        setShowRecoveryModal(true);
      } else if (permissionState === 'granted') {
        startCall();
      }
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isCallActive) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#F9F6F3] rounded-3xl p-6 sm:p-8 max-w-md w-full mx-4 shadow-2xl border border-[#E8DDD2]"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-[#3B3632]">Voice Call</h2>
            <button
              onClick={isCallActive ? endCall : onClose}
              className="p-2 rounded-lg hover:bg-[#F0E6DC] transition-colors"
            >
              <X className="w-5 h-5 text-[#8B7E74]" />
            </button>
          </div>

          {/* Call Status */}
          <div className="text-center mb-8">
            {isCallActive ? (
              <>
                <div className="relative inline-flex items-center justify-center mb-4">
                  {/* Audio level visualization */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className={`w-32 h-32 rounded-full transition-all ${
                        callStatus === 'speaking' ? 'bg-[#8FA67E]/30' :
                        callStatus === 'thinking' ? 'bg-[#B8A5D6]/30 animate-pulse' :
                        callStatus === 'transcribing' ? 'bg-[#C6D4B0]/30 animate-pulse' :
                        'bg-[#8FA67E]/20'
                      }`}
                      style={{
                        transform: callStatus === 'listening' ? `scale(${1 + audioLevel * 0.5})` : 'scale(1.1)',
                      }}
                    />
                  </div>
                  <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-colors ${
                    callStatus === 'speaking' ? 'bg-[#8FA67E]' :
                    callStatus === 'thinking' ? 'bg-[#B8A5D6]' :
                    callStatus === 'transcribing' ? 'bg-[#C6D4B0]' :
                    'bg-[#8FA67E]'
                  }`}>
                    <Phone className="w-12 h-12 text-white" />
                  </div>
                </div>
                <p className="text-lg font-medium mb-2 text-[#8FA67E]">
                  Voice Call Active
                </p>
                <p className="text-[#5A524A] text-3xl font-mono">{formatDuration(callDuration)}</p>
                {(tierFeatures[tier] as any).voiceCallMaxDuration === -1 && (
                  <p className="text-[#8B7E74] text-sm mt-2">Unlimited</p>
                )}
                
                {/* ✅ IMPROVEMENT: Connection status indicator */}
                {isCallActive && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <div className={`w-2 h-2 rounded-full ${
                      networkQuality === 'excellent' ? 'bg-green-500' :
                      networkQuality === 'good' ? 'bg-yellow-500' :
                      networkQuality === 'poor' ? 'bg-orange-500' :
                      'bg-red-500 animate-pulse'
                    }`} />
                    <span className="text-xs text-[#8B7E74]">
                      {networkQuality === 'excellent' ? 'Excellent connection' :
                       networkQuality === 'good' ? 'Good connection' :
                       networkQuality === 'poor' ? 'Poor connection' :
                       'Reconnecting...'}
                    </span>
                  </div>
                )}
                
                {/* Microphone Level Indicator - ChatGPT Style */}
                {callStatus === 'listening' && (
                  <div className="mt-4 w-full max-w-xs mx-auto">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[#8B7E74] text-xs">Mic Level:</p>
                      <p className={`text-xs font-medium ${
                        micLevel > 30 ? 'text-[#8FA67E]' : 
                        micLevel > 10 ? 'text-[#F3B562]' : 
                        'text-[#B8A9A0]'
                      }`}>
                        {micLevel}%
                      </p>
                    </div>
                    <div className="w-full h-2 bg-[#E8DDD2] rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-100 ${
                          micLevel > 30 ? 'bg-[#8FA67E]' :
                          micLevel > 10 ? 'bg-[#F3B562]' :
                          'bg-[#B8A9A0]'
                        }`}
                        style={{ width: `${micLevel}%` }}
                      />
                    </div>
                    <p className="text-[#8B7E74] text-xs mt-1 text-center">
                      {micLevel < 10 ? '🤫 Speak to be heard' : 
                       micLevel < 30 ? '🎤 Speaking...' : 
                       '✅ Clear audio!'}
                    </p>
                    {isPushToTalk && (
                      <p className="text-[#8FA67E] text-xs mt-1 text-center flex items-center justify-center gap-1">
                        {isSpacePressed ? '🎤 Recording...' : '⏸️ Hold Space to speak'}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Beta Label */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <p className="text-amber-800 text-sm">
                    🎙️ <strong>Voice Chat (Beta)</strong>: Response times 5-10 seconds. 
                    Real-time voice coming Q1 2025.
                  </p>
                </div>
                
                <div className="w-24 h-24 rounded-full bg-[#F0E6DC] flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-12 h-12 text-[#8B7E74]" />
                </div>
                <p className="text-[#5A524A] text-lg">Ready to start voice call</p>
                <p className="text-[#8B7E74] text-sm mt-2">Studio tier exclusive feature</p>
              </>
            )}
          </div>

          {/* Transcript Display - Phase 1 Improvement (Larger, Auto-scroll, Copy) */}
          {isCallActive && (lastTranscript || lastAIResponse) && (
            <div className="mb-6 space-y-3">
              <div 
                ref={transcriptRef}
                className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 scroll-smooth"
                style={{ scrollBehavior: 'smooth' }}
              >
              {lastTranscript && (
                <div className="bg-[#C6D4B0]/20 border border-[#C6D4B0]/40 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                  <p className="text-[#8FA67E] text-xs font-medium mb-1">You said:</p>
                  <p className="text-[#3B3632] text-sm">{lastTranscript}</p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(lastTranscript);
                          modernToast.success('Copied to clipboard');
                        }}
                        className="p-1.5 rounded-lg hover:bg-[#C6D4B0]/30 transition-colors"
                        title="Copy transcript"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#8FA67E]" />
                      </button>
                    </div>
                </div>
              )}
              {lastAIResponse && (
                <div className="bg-[#B8A5D6]/20 border border-[#B8A5D6]/40 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                  <p className="text-[#8B7AB8] text-xs font-medium mb-1">Atlas:</p>
                  <p className="text-[#3B3632] text-sm">{lastAIResponse}</p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(lastAIResponse);
                          modernToast.success('Copied to clipboard');
                        }}
                        className="p-1.5 rounded-lg hover:bg-[#B8A5D6]/30 transition-colors"
                        title="Copy response"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#8B7AB8]" />
                      </button>
                    </div>
                </div>
                )}
              </div>
              {/* Copy Full Transcript Button */}
              {(lastTranscript || lastAIResponse) && (
                <button
                  onClick={() => {
                    const fullTranscript = [
                      lastTranscript ? `You: ${lastTranscript}` : '',
                      lastAIResponse ? `Atlas: ${lastAIResponse}` : ''
                    ].filter(Boolean).join('\n\n');
                    navigator.clipboard.writeText(fullTranscript);
                    modernToast.success('Full transcript copied');
                  }}
                  className="w-full px-4 py-2 text-sm rounded-lg bg-[#F0E6DC] hover:bg-[#E8DDD2] text-[#5A524A] transition-colors flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Full Transcript
                </button>
              )}
            </div>
          )}

          {/* Call Controls */}
          <div className="flex items-center justify-center gap-4">
            {isCallActive ? (
              <>
                {/* Mute Button - ✅ BEST PRACTICE: Accessibility and feedback */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleMute}
                  disabled={isPushToTalk || !isCallActive}
                  aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  aria-pressed={isMuted}
                  className={`p-4 rounded-full transition-colors ${
                    isMuted
                      ? 'bg-[#CF9A96] hover:bg-[#C18A86]'
                      : isPushToTalk || !isCallActive
                      ? 'bg-[#E8DDD2] cursor-not-allowed opacity-50'
                      : 'bg-[#F0E6DC] hover:bg-[#E8DDD2]'
                  }`}
                  title={isPushToTalk ? 'Disabled in push-to-talk mode' : !isCallActive ? 'Call not active' : (isMuted ? 'Unmute microphone' : 'Mute microphone')}
                >
                  {isMuted ? (
                    <MicOff className="w-6 h-6 text-white" aria-hidden="true" />
                  ) : (
                    <Mic className="w-6 h-6 text-[#5A524A]" aria-hidden="true" />
                  )}
                </motion.button>

                {/* End Call Button - ✅ BEST PRACTICE: Prevent double-click and accessibility */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={endCall}
                  disabled={isEndingCall}
                  aria-label="End voice call"
                  className={`p-6 rounded-full bg-[#CF9A96] hover:bg-[#C18A86] transition-colors ${
                    isEndingCall ? 'opacity-50 cursor-wait' : ''
                  }`}
                  title={isEndingCall ? 'Ending call...' : 'End voice call'}
                >
                  {isEndingCall ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-8 h-8 border-2 border-white border-t-transparent rounded-full"
                      aria-hidden="true"
                    />
                  ) : (
                    <PhoneOff className="w-8 h-8 text-white" aria-hidden="true" />
                  )}
                </motion.button>

                {/* Push-to-Talk Toggle - ChatGPT Style */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={togglePushToTalk}
                  className={`p-4 rounded-full transition-colors ${
                    isPushToTalk
                      ? 'bg-[#8FA67E] hover:bg-[#7E9570]'
                      : 'bg-[#F0E6DC] hover:bg-[#E8DDD2]'
                  }`}
                  title={isPushToTalk ? 'Disable push-to-talk' : 'Enable push-to-talk'}
                >
                  <Volume2 className={`w-6 h-6 ${isPushToTalk ? 'text-white' : 'text-[#8B7E74]'}`} />
                </motion.button>
              </>
            ) : (
              /* Start Call Button */
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={startCall}
                disabled={!canUseVoiceEmotion(tier)}
                className={`px-8 py-4 rounded-full font-medium transition-colors ${
                  canUseVoiceEmotion(tier)
                    ? 'bg-[#8FA67E] hover:bg-[#7E9570] text-white'
                    : 'bg-[#E8DDD2] text-[#B8A9A0] cursor-not-allowed'
                }`}
              >
                {canUseVoiceEmotion(tier) ? 'Start Voice Call' : 'Studio Tier Required'}
              </motion.button>
            )}
          </div>

          {/* Features Info */}
          {!isCallActive && (
            <div className="mt-8 p-4 bg-[#F0E6DC]/50 rounded-xl border border-[#E8DDD2]">
              <p className="text-[#5A524A] text-sm mb-2 font-medium">🎙️ Atlas Voice Features:</p>
              <ul className="text-[#8B7E74] text-xs space-y-1">
                <li>• Real-time voice conversation</li>
                <li>• Instant response when you stop speaking</li>
                <li>• Push-to-talk mode (hold Space to speak)</li>
                <li>• Live audio level visualization</li>
                <li>• Unlimited duration (Studio tier)</li>
              </ul>
            </div>
          )}

          {/* Keyboard Shortcuts */}
          {isCallActive && (
            <div className="mt-6 p-3 bg-[#F0E6DC]/50 rounded-xl border border-[#E8DDD2]">
              <p className="text-[#8B7E74] text-xs text-center">
                {isPushToTalk ? (
                  <>
                    <span className="inline-block px-2 py-0.5 bg-[#8FA67E]/50 rounded mr-1 text-white">Hold Space</span> Speak • 
                    <span className="inline-block px-2 py-0.5 bg-[#E8DDD2] rounded mx-1 text-[#5A524A]">Esc</span> End Call
                  </>
                ) : (
                  <>
                    <span className="inline-block px-2 py-0.5 bg-[#E8DDD2] rounded mr-1 text-[#5A524A]">Space</span> Mute • 
                    <span className="inline-block px-2 py-0.5 bg-[#E8DDD2] rounded mx-1 text-[#5A524A]">Esc</span> End Call
                  </>
                )}
              </p>
            </div>
          )}
        </motion.div>

        {/* ✅ Permission Context Modal */}
        {showPermissionModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-[#F9F6F3] rounded-2xl p-6 max-w-md w-full border border-[#8FA67E]/30 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-[#8FA67E]/20 rounded-full">
                  <Mic className="w-6 h-6 text-[#8FA67E]" />
                </div>
                <h3 className="text-xl font-semibold text-[#3B3632]">Microphone Access Needed</h3>
              </div>
              
              <p className="text-[#5A524A] mb-4">
                Atlas needs access to your microphone to have voice conversations with you.
              </p>
              
              <div className="bg-[#C6D4B0]/20 border border-[#C6D4B0]/40 rounded-lg p-4 mb-6">
                <p className="text-[#8FA67E] text-sm font-medium mb-2">What happens next:</p>
                <ul className="text-[#5A524A] text-sm space-y-1">
                  <li>• Your browser will ask for permission</li>
                  <li>• Click "Allow" to start the call</li>
                  <li>• Your audio stays private and secure</li>
                </ul>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPermissionModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-[#E8DDD2] hover:bg-[#DFC9B6] text-[#5A524A] font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestPermission}
                  className="flex-1 px-4 py-3 rounded-xl bg-[#8FA67E] hover:bg-[#7E9570] text-white font-medium transition-colors"
                >
                  Allow Microphone
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ✅ Permission Denied Recovery Modal */}
        {showRecoveryModal && (() => {
          const { platform, steps } = getPlatformInstructions();
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <div className="bg-[#F9F6F3] rounded-2xl p-6 max-w-md w-full border border-[#CF9A96]/30 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-[#CF9A96]/20 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-[#CF9A96]" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#3B3632]">Microphone Access Denied</h3>
                </div>
                
                <p className="text-[#5A524A] mb-4">
                  Voice calls require microphone access. Here's how to enable it in <strong>{platform}</strong>:
                </p>
                
                <div className="bg-[#F0E6DC] rounded-lg p-4 mb-6">
                  <ol className="text-[#5A524A] text-sm space-y-2">
                    {steps.map((step, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="text-[#8FA67E] font-semibold">{index + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                
                <div className="flex items-center gap-2 text-[#8FA67E] text-sm mb-6">
                  <Settings className="w-4 h-4" />
                  <p>After enabling, click "Try Again" below</p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRecoveryModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-[#E8DDD2] hover:bg-[#DFC9B6] text-[#5A524A] font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRetryPermission}
                    className="flex-1 px-4 py-3 rounded-xl bg-[#8FA67E] hover:bg-[#7E9570] text-white font-medium transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* ✅ Microphone Help Modal (dedicated component) */}
        <MicrophoneHelpModal
          isOpen={!!permissionError}
          onClose={() => {
            setPermissionError(null);
            setShowRecoveryModal(false);
          }}
        />

        {/* ✅ HTTPS Warning Modal */}
        {showHTTPSWarning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-[#F9F6F3] rounded-2xl p-6 max-w-md w-full border border-[#F3B562]/30 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-[#F3B562]/20 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-[#F3B562]" />
                </div>
                <h3 className="text-xl font-semibold text-[#3B3632]">HTTPS Required</h3>
              </div>
              
              <p className="text-[#5A524A] mb-4">
                iOS Safari requires a secure connection (HTTPS) for microphone access on non-localhost URLs.
              </p>
              
              <div className="bg-[#F3B562]/10 border border-[#F3B562]/20 rounded-lg p-4 mb-6">
                <p className="text-[#F3B562] text-sm font-medium mb-2">Solutions:</p>
                <ul className="text-[#5A524A] text-sm space-y-1">
                  <li>• Use <code className="bg-[#E8DDD2] px-1 rounded">{window.location.hostname}</code></li>
                  <li>• Set up HTTPS for local development</li>
                  <li>• Use Atlas on desktop for testing</li>
                </ul>
              </div>
              
              <div className="flex items-center gap-2 text-[#8B7E74] text-xs mb-6">
                <CheckCircle className="w-4 h-4" />
                <p>This is a browser security requirement, not an Atlas limitation</p>
              </div>
              
              <button
                onClick={() => setShowHTTPSWarning(false)}
                className="w-full px-4 py-3 rounded-xl bg-[#E8DDD2] hover:bg-[#DFC9B6] text-[#5A524A] font-medium transition-colors"
              >
                Got It
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
