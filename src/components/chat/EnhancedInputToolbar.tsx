import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Image, Loader2, Mic, Plus, Send, Square, X, XCircle } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { modernToast } from '../../config/toastConfig';
import { useUpgradeModals } from '../../contexts/UpgradeModalContext';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useFeatureAccess, useTierAccess } from '../../hooks/useTierAccess';
import { sendMessageWithAttachments, stopMessageStream } from '../../services/chatService';
import '../../styles/voice-animations.css';
import type { Message } from '../../types/chat';
// Removed useMessageStore import - using props from parent component
import { logger } from '../../lib/logger';
import { voiceService } from '../../services/voiceService';
import { isAudioRecordingSupported } from '../../utils/audioHelpers';
import { generateUUID } from '../../utils/uuid';
import AttachmentMenu from './AttachmentMenu';

interface EnhancedInputToolbarProps {
  onSendMessage: (message: string) => void;
  isProcessing?: boolean;
  disabled?: boolean;
  placeholder?: string;
  conversationId?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  isVisible?: boolean;
  onSoundPlay?: (soundType: string) => void;
  addMessage?: (message: Message) => void;
  isStreaming?: boolean;
}

export default function EnhancedInputToolbar({
  onSendMessage,
  isProcessing = false,
  disabled = false,
  placeholder = "Ask anything...",
  conversationId,
  inputRef: externalInputRef,
  isVisible = true,
  onSoundPlay,
  addMessage,
  isStreaming = false
}: EnhancedInputToolbarProps) {
  const { user } = useSupabaseAuth();
  const { tier } = useTierAccess();
  // ✅ REMOVED: canUseVoice (call button removed)
  const { canUse: canUseImage } = useFeatureAccess('image');
  const { canUse: canUseAudio, attemptFeature: attemptAudio } = useFeatureAccess('audio'); // ✅ Add audio feature access
  const { showGenericUpgrade } = useUpgradeModals();
  
  // ✅ REMOVED: isStudioTier check (call button removed)
  
  // Upgrade modal handler (from useTierAccess hook)
  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [attachmentPreviews, setAttachmentPreviews] = useState<any[]>([]);
  // ✅ REMOVED: Voice call state (call button removed per user request)
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'uploading' | 'processing' | 'success' | 'error'>>({});
  const [isUploading, setIsUploading] = useState(false);
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ VOICE RECORDING IMPROVEMENTS: Press-and-hold detection
  const pressHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isPressHoldActive, setIsPressHoldActive] = useState(false);
  const [slideCancelDistance, setSlideCancelDistance] = useState(0);
  
  // ✅ REMOVED: Toggle mode state - using intelligent single-button approach
  
  // ✅ FEATURE DETECTION: Check if voice recording is supported
  const [isVoiceSupported, setIsVoiceSupported] = useState(true);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  
  // Use external ref if provided, otherwise use internal ref
  const inputRef = externalInputRef || internalInputRef;

  // ✅ FEATURE DETECTION: Check browser support on mount
  useEffect(() => {
    const supported = isAudioRecordingSupported();
    setIsVoiceSupported(supported);
    
    if (!supported) {
      logger.warn('[Voice] Audio recording not supported in this browser');
    }
    
    // ✅ PRIVACY NOTICE: Check if user has seen privacy notice
    const hasSeenPrivacyNotice = localStorage.getItem('atlas-voice-privacy-notice-seen');
    if (!hasSeenPrivacyNotice && supported) {
      // Show privacy notice after a short delay (not immediately)
      const timer = setTimeout(() => {
        setShowPrivacyNotice(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  // ✅ SOUND CUES: Play subtle beep sounds
  const playSoundCue = (type: 'start' | 'stop') => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      if (type === 'start') {
        // Single beep (800Hz, 100ms) for start
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      } else {
        // Double beep (600Hz, 50ms each) for stop
        oscillator.frequency.value = 600;
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.05);
        
        // Second beep after 50ms
        setTimeout(() => {
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.frequency.value = 600;
          gain2.gain.setValueAtTime(0.1, audioContext.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
          osc2.start(audioContext.currentTime);
          osc2.stop(audioContext.currentTime + 0.05);
        }, 50);
      }
    } catch (error) {
      // Silently fail if audio context not available
      logger.debug('[Voice] Sound cue failed:', error);
    }
  };

  // ✅ Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (pressHoldTimerRef.current) {
        clearTimeout(pressHoldTimerRef.current);
      }
    };
  }, []);

  // ✅ Auto-focus immediately when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current && isVisible) {
        inputRef.current.focus();
        logger.debug('[EnhancedInputToolbar] ✅ Input focused on mount');
      }
    }, 100); // Shorter delay for immediate focus
    return () => clearTimeout(timer);
  }, []); // Run once on mount

  // ✅ Re-focus when visibility changes
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
      logger.debug('[EnhancedInputToolbar] ✅ Input focused on visibility change');
    }
  }, [isVisible]);

  // ✅ Auto-expand textarea as user types (ChatGPT-style) - OPTIMIZED
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      // Use requestAnimationFrame to batch DOM updates
      requestAnimationFrame(() => {
        // Store current scroll position to prevent jump
        const scrollTop = textarea.scrollTop;
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 140);
        textarea.style.height = `${newHeight}px`;
        textarea.scrollTop = scrollTop;
      });
    }
  }, [text]); // Re-run when text changes

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isStreaming) {
        stopMessageStream();
        modernToast.success("Message Cancelled", "Stopped AI response");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStreaming]);

  // ✅ TIER-AWARE MESSAGE LIMITS (Profit Protection)
  // Aligned with token monitoring system: ~4 characters per token
  // Limits based on maxTokensPerResponse × multiplier for good UX
  const TIER_LIMITS: Record<string, number> = {
    free: 2000,    // ~500 tokens (maxTokensPerResponse: 100 × 5) - Protects $0/month margin
    core: 4000,    // ~1000 tokens (maxTokensPerResponse: 250 × 4) - Protects $19.99/month margin
    studio: 8000,  // ~2000 tokens (maxTokensPerResponse: 400 × 5) - Protects $149.99/month margin
  };

  const maxLength = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const currentLength = text.length;
  const percentUsed = maxLength > 0 ? (currentLength / maxLength) * 100 : 0;
  const showCounter = percentUsed > 80; // Only show when >80% used (professional, non-distracting)

  const handleSend = async () => {
    if (isProcessing || disabled) return;
    
    // ✅ IMMEDIATE UI CLEAR - Clear attachments and text instantly for better UX
    const currentText = text.trim();
    const currentAttachments = [...attachmentPreviews];
    
    // ✅ SECURITY: Validate message length (prevent abuse, protect API costs) - Tier-aware
    if (currentText && currentText.length > maxLength) {
      modernToast.error(
        'Message Too Long',
        `Please keep messages under ${maxLength.toLocaleString()} characters for your ${tier} tier.`
      );
      return;
    }
    
    // ✅ FIX: Clear UI immediately but prevent height animation glitch
    // Temporarily disable transitions on textarea
    if (inputRef.current) {
      inputRef.current.style.transition = 'none';
    }
    
    setAttachmentPreviews([]);
    setText('');
    
    // Re-enable transitions after clearing (smooth for future typing)
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.style.transition = '';
      }
    });
    
    // Show immediate feedback
    if (onSoundPlay) {
      onSoundPlay('send_message');
    }
    
    // 🎯 FUTURE-PROOF FIX: Send attachments even without conversationId (backend will create one)
    if (currentAttachments.length > 0) {
      const attachments = currentAttachments.map(att => ({
        id: att.id, // ✅ FIX: Include ID for status tracking
        type: att.type,
        file: att.file,
        previewUrl: att.previewUrl,
        url: att.url || att.publicUrl, // Use uploaded URL
        name: att.name
      }));
      
      // ✅ REMOVED: Duplicate toast notification - using only floating overlay
      // Keep only the professional bottom-center indicator

      try {
        // Update status to analyzing (more specific feedback)
        attachments.forEach((att: { id?: string; type: string; url?: string }) => {
          if (att.id) {
            setUploadStatus(prev => ({ ...prev, [att.id!]: 'processing' as const }));
          }
        });
        
        // Set processing state for floating indicator
        setIsUploading(true);
        
        logger.debug('[EnhancedInputToolbar] 🚀 Starting sendMessageWithAttachments...');
        
        // Use Promise.race for timeout protection (increased timeout for image analysis)
        if (addMessage) {
          await Promise.race([
            sendMessageWithAttachments(conversationId || '', attachments, addMessage, currentText || undefined, user?.id),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Send timeout')), 15000) // Reduced from 30000ms for better mobile UX
            )
          ]);
        }
        
        logger.debug('[EnhancedInputToolbar] ✅ sendMessageWithAttachments completed');
        
        // Update status to success
        attachments.forEach((att: { id?: string; type: string; url?: string }) => {
          if (att.id) {
            setUploadStatus(prev => ({ ...prev, [att.id!]: 'success' as const }));
          }
        });
        
        // ✅ REMOVED: Success toast - floating overlay is sufficient
        // Professional, non-intrusive UX
        
        // Clear upload status after success
        setTimeout(() => {
          setIsUploading(false);
          setUploadStatus({});
        }, 1500);
      } catch (error) {
        logger.error('[EnhancedInputToolbar] ❌ sendMessageWithAttachments failed:', error);
        
        // Update status to error
        attachments.forEach((att: { id?: string; type: string; url?: string }) => {
          if (att.id) {
            setUploadStatus(prev => ({ ...prev, [att.id!]: 'error' as const }));
          }
        });
        
        // ✅ REMOVED: Toast dismiss (no toast to dismiss)
        // Error handling through floating overlay only
        
        // More specific error messages
        if (error instanceof Error && error.message === 'Send timeout') {
          modernToast.error("Analysis Timeout", "Image is taking too long. Try a smaller file.");
        } else if (error instanceof Error) {
          modernToast.error("Analysis Failed", error.message || "Could not send attachment. Please try again.");
        } else {
          modernToast.error("Upload Failed", "Could not send attachment. Please try again.");
        }
        
        // Restore attachments on error
        setAttachmentPreviews(currentAttachments);
        setText(currentText);
        
        // Clear error status after 3 seconds
        setTimeout(() => {
          setIsUploading(false);
          setUploadStatus({});
        }, 3000);
      }
    } else if (currentText) {
      // Regular text message
      onSendMessage(currentText);
    }
    
    // ✅ Refocus after sending if still visible
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Handle adding attachments to input area
  const handleAddAttachment = (attachment: { id: string; type: string; url?: string; publicUrl?: string; file?: File }) => {
    const attachmentWithId = {
      ...attachment,
      id: attachment.id || generateUUID() // Ensure it has an ID
    };
    setAttachmentPreviews(prev => [...prev, attachmentWithId]);
    
    // Show uploading briefly, then success
    setUploadStatus(prev => ({ ...prev, [attachmentWithId.id]: 'uploading' }));
    setTimeout(() => {
      setUploadStatus(prev => ({ ...prev, [attachmentWithId.id]: 'success' }));
    }, 500);
    
    // Don't set isUploading here - let the upload cards handle the loading state
    
    // 🎯 FUTURE-PROOF FIX: Auto-focus input for caption
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  // Handle removing attachments from input area
  const removeAttachment = (attachmentId: string) => {
    setAttachmentPreviews(prev => prev.filter(att => att.id !== attachmentId));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  // ✅ Handle clicking outside to close menu (but allow clicks inside AttachmentMenu)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuOpen) {
        const target = event.target as Node;
        const isInsideButton = buttonRef.current?.contains(target);
        const isInsideAttachmentMenu = document.querySelector('[data-attachment-menu]')?.contains(target);
        
        if (!isInsideButton && !isInsideAttachmentMenu) {
          setMenuOpen(false);
          // Refocus input when closing the menu via click outside
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.focus();
            }
          }, 200);
        }
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // 📱 Handle input blur to minimize when clicking outside (ChatGPT-like behavior)
  const handleInputBlur = () => {
    // Small delay to allow for menu interactions
    setTimeout(() => {
      if (inputRef.current && !menuOpen) {
        // Blur the input to dismiss keyboard
        inputRef.current.blur();
        // Reset to single row for minimized state
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
          inputRef.current.rows = 1;
        }
      }
    }, 100);
  };

  // 🎯 Handle input focus with bounce animation (ChatGPT-like behavior)
  const handleInputFocus = () => {
    // The bounce animation will be handled by the motion.div
  };

  // Format recording time (0:03)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cancel recording
  const handleCancelRecording = () => {
    const mediaRecorder = (window as any).__atlasMediaRecorder;
    const stream = (window as any).__atlasMediaStream;
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    
    if (stream) {
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    }
    
    // Clear timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    
    setIsListening(false);
    setRecordingDuration(0);
    
    // Clean up references
    delete (window as any).__atlasMediaRecorder;
    delete (window as any).__atlasMediaStream;
    
    modernToast.warning("Recording Cancelled", "Voice note discarded");
  };

  // ✅ VOICE RECORDING IMPROVEMENTS: Enhanced press-and-hold handlers
  const handleMicPressStart = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    if (!user) {
      modernToast.error('Login Required', 'Sign in to use voice features');
      return;
    }

    // ✅ Use centralized feature access check
    const hasAccess = await attemptAudio();
    if (!hasAccess) {
      // attemptAudio already shows upgrade modal
      return;
    }

    if (isListening) {
      // Already recording - stop it
      handleMicPressEnd();
      return;
    }

    // ✅ BEST PRACTICE: Store touch start position for slide-to-cancel
    if ('touches' in e) {
      const touch = e.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    } else {
      touchStartPosRef.current = { x: e.clientX, y: e.clientY };
    }

    // ✅ BEST PRACTICE: Press-and-hold detection (250ms delay to prevent accidental taps)
    setIsPressHoldActive(true);
    
    // Haptic feedback on press start
    if ('vibrate' in navigator) {
      navigator.vibrate(10); // Light tap feedback
    }

    pressHoldTimerRef.current = setTimeout(async () => {
      // ✅ After 250ms, start recording
      await startRecording();
      setIsPressHoldActive(false);
      
      // Stronger haptic feedback when recording actually starts
      if ('vibrate' in navigator) {
        navigator.vibrate([20, 10, 20]); // Double pulse for recording start
      }
    }, 250);
  };

  const handleMicPressEnd = () => {
    // Clear press-and-hold timer if recording hasn't started yet
    if (pressHoldTimerRef.current) {
      clearTimeout(pressHoldTimerRef.current);
      pressHoldTimerRef.current = null;
    }
    
    setIsPressHoldActive(false);
    touchStartPosRef.current = null;
    setSlideCancelDistance(0);

    // If recording, stop it
    if (isListening) {
      stopRecording();
    }
  };

  const handleMicPressMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStartPosRef.current || !isListening) return;

    // Calculate distance from start position
    let currentX: number, currentY: number;
    if ('touches' in e) {
      const touch = e.touches[0];
      currentX = touch.clientX;
      currentY = touch.clientY;
    } else {
      currentX = e.clientX;
      currentY = e.clientY;
    }

    const deltaX = currentX - touchStartPosRef.current.x;
    const deltaY = currentY - touchStartPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    setSlideCancelDistance(distance);

    // ✅ BEST PRACTICE: Slide-to-cancel (cancel if moved > 50px upward)
    if (deltaY < -50) {
      handleCancelRecording();
      if ('vibrate' in navigator) {
        navigator.vibrate(30); // Cancel feedback
      }
    }
  };

  const startRecording = async () => {
    if (isListening) return; // Prevent double-start

    try {
      // ✅ BEST PRACTICE: Audio quality constraints (echo cancellation, noise suppression)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        } 
      });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks: Blob[] = [];
        
        // Store mediaRecorder reference for stopping
        (window as any).__atlasMediaRecorder = mediaRecorder;
        (window as any).__atlasMediaStream = stream;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = async () => {
          try {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
            // 🎯 Transcribe audio and send immediately (ChatGPT-style)
            modernToast.info('Transcribing...', 'Converting speech to text');
            const transcript = await voiceService.recordAndTranscribe(audioBlob, tier as 'free' | 'core' | 'studio');
            
            // Auto-send the transcribed message
            if (transcript && transcript.trim()) {
              modernToast.success('Voice Transcribed', 'Sending to Atlas...');
              // Send immediately
              onSendMessage(transcript);
            } else {
              modernToast.error('No Speech Detected', 'Please speak clearly and try again');
            }
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to process voice message';
            modernToast.error('Transcription Failed', errorMessage);
          } finally {
            setIsListening(false);
            setRecordingDuration(0);
            // Clear timer
            if (recordingTimerRef.current) {
              clearInterval(recordingTimerRef.current);
            }
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
            // Clean up references
            delete (window as any).__atlasMediaRecorder;
            delete (window as any).__atlasMediaStream;
          }
        };
        
        mediaRecorder.start();
        setIsListening(true);
        setRecordingDuration(0);
      
      // ✅ SOUND CUE: Play start beep
      playSoundCue('start');
      
        modernToast.success('Recording Started', 'Speak clearly for best results');
        
        // Start timer
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
        
        // Auto-stop after 30 seconds
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            if (recordingTimerRef.current) {
              clearInterval(recordingTimerRef.current);
            }
            mediaRecorder.stop();
          }
        }, 30000);
        
      } catch (error) {
      // ✅ IMPROVED ERROR GUIDANCE: Browser-specific instructions
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      let errorMessage = 'Microphone access blocked';
      let guidance = '';
      
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isChrome = /Chrome/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !isChrome;
        
        if (isIOS && isSafari) {
          guidance = 'Go to Settings → Safari → Microphone → Allow';
        } else if (isChrome) {
          guidance = 'Click the lock icon in address bar → Allow microphone';
        } else {
          guidance = 'Check browser settings → Privacy → Microphone permissions';
        }
        
        modernToast.error(errorMessage, guidance);
        // Show additional help link after a delay
        setTimeout(() => {
          modernToast.info('Need Help?', 'Click for browser-specific instructions');
          // Make toast clickable
          setTimeout(() => {
            const toastElement = document.querySelector('[data-sonner-toast]') as HTMLElement | null;
            if (toastElement) {
              toastElement.style.cursor = 'pointer';
              toastElement.addEventListener('click', () => {
                window.open('https://support.google.com/chrome/answer/2693767', '_blank');
              }, { once: true });
            }
          }, 100);
        }, 2000);
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        modernToast.error('No Microphone Found', 'Please connect a microphone and try again');
    } else {
        modernToast.error('Microphone Error', error instanceof Error ? error.message : 'Please try again');
      }
      
      setIsListening(false);
      setIsPressHoldActive(false);
    }
  };

  const stopRecording = () => {
      const mediaRecorder = (window as any).__atlasMediaRecorder;
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
      
      // ✅ SOUND CUE: Play stop beep
      playSoundCue('stop');
      
        mediaRecorder.stop();
        modernToast.info('Processing Audio', 'Converting to text...');
      }
      setIsListening(false);
      setRecordingDuration(0);
  };

  // ✅ INTELLIGENT SINGLE BUTTON: Handles both quick clicks and hold
  // Desktop: Quick click = immediate start, Hold = press-and-hold
  // Mobile: Quick tap = immediate start, Hold = press-and-hold with slide-to-cancel
  const handleMicPress = async (e?: React.MouseEvent) => {
    // Prevent double-triggering with onMouseDown/onTouchStart
    // If press-hold timer is active or we just handled a press-hold, ignore onClick
    if (pressHoldTimerRef.current || isPressHoldActive) {
      return; // Already handled by onMouseDown/onTouchStart
    }
    
    // Don't preventDefault - let browser handle naturally
    if (e) {
      e.stopPropagation(); // Prevent bubbling but allow default behavior
    }
    
    // If already recording, stop it
    if (isListening) {
      stopRecording();
      return;
    }
    
    // Check user and permissions
    if (!user) {
      modernToast.error('Login Required', 'Sign in to use voice features');
      return;
    }
    
    const hasAccess = await attemptAudio();
    if (!hasAccess) {
      return;
    }
    
    // Quick click/tap - start recording immediately (no delay)
    await startRecording();
  };

  // ✅ REMOVED: handleStartVoiceCall function (call button removed)


  // Click outside detection is handled by AttachmentMenu component

  return (
    <>
      {/* ✅ BEST PRACTICE: Attachment Previews - Positioned above input, not constrained */}
      {attachmentPreviews.length > 0 && (
        <div className="mb-3 px-4 sm:px-6">
          {/* Subtle Hint */}
          <div className="flex items-center gap-2 mb-2 px-1 max-w-4xl mx-auto">
            <span className="text-xs text-gray-400">Add an optional caption below</span>
          </div>
          
          <div className="flex flex-wrap gap-2 max-w-4xl mx-auto">
            {attachmentPreviews.map((attachment) => {
              const status = uploadStatus[attachment.id] || 'uploading';
              return (
                <motion.div 
                  key={attachment.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center justify-between rounded-2xl bg-white/90 border border-atlas-sand/30 p-2 mt-2 transition-all max-w-[90vw]"
                >
                  <div className="flex items-center space-x-3">
                    {attachment.type === 'image' && (
                      <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-gray-700">
                        <img
                          src={attachment.url || attachment.publicUrl || attachment.previewUrl}
                          alt={attachment.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                    <Image className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm text-neutral-200 truncate">{attachment.name}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {status === 'uploading' && (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                        <span className="text-xs text-neutral-400">Uploading...</span>
                      </>
                    )}
                    {status === 'processing' && (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-atlas-sage" />
                        <span className="text-xs text-atlas-sage">Processing...</span>
                      </>
                    )}
                    {status === 'success' && (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-green-400">Ready</span>
                      </>
                    )}
                    {status === 'error' && (
                      <>
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span className="text-xs text-red-400">Failed</span>
                      </>
                    )}
                    
                    <button
                      onClick={() => removeAttachment(attachment.id)}
                      className="p-1 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <X className="w-4 h-4 text-neutral-400" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* ✅ BEST PRACTICE: Loading Indicator - Fixed positioning relative to viewport */}
      {isUploading && attachmentPreviews.length === 0 && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center z-50 px-4">
          <div className="flex items-center space-x-2 bg-neutral-900/90 rounded-full px-4 py-2 shadow-xl border border-white/20 backdrop-blur-sm">
            <Loader2 className="w-4 h-4 animate-spin text-white/90" />
            <span className="text-sm text-white/90 font-medium">Analyzing image...</span>
          </div>
        </div>
      )}
      
      {/* ✅ BEST PRACTICE: Recording Indicator - Fixed positioning relative to viewport */}
      {isListening && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-24 left-0 right-0 flex justify-center z-50 px-4"
        >
          <div className="flex items-center space-x-3 bg-red-500/95 rounded-full px-5 py-3 shadow-2xl border border-red-400/50 backdrop-blur-sm">
            {/* Pulsing dot */}
            <div className="relative flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              <div className="absolute w-3 h-3 bg-white rounded-full animate-ping"></div>
            </div>
            
            {/* Timer */}
            <span className="text-white font-mono font-medium text-base">
              {formatTime(recordingDuration)}
            </span>
            
            {/* Cancel button */}
            <button
              onClick={handleCancelRecording}
              className="ml-2 p-1.5 rounded-full hover:bg-white/20 transition-colors"
              title="Cancel recording"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </motion.div>
      )}
      
      {/* ✅ UNIFIED INPUT BAR: Mobile floating overlay + Desktop static footer */}
      <motion.div 
        data-input-area
        className="
          unified-input-bar
          flex items-center w-full max-w-4xl mx-auto px-2 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 
          rounded-t-2xl sm:rounded-[2rem]
          bg-white/70 backdrop-blur-md shadow-lg mb-0
          sm:bg-gradient-to-r sm:from-atlas-pearl sm:via-atlas-peach sm:to-atlas-pearl
          sm:backdrop-blur-0 sm:border-2 sm:border-atlas-sand sm:shadow-lg sm:mb-2
        "
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          gap: '8px', // ✅ BEST PRACTICE: Consistent gap between elements
          transform: 'translateZ(0)', // ✅ GPU acceleration - prevents blur artifacts
          willChange: 'transform' // ✅ Optimize for animations
        }}
      >
        
        {/* + Attachment Button - ✅ BEST PRACTICE: Fixed size, no flex-shrink */}
        <div className="relative flex-shrink-0">
              <motion.button
                ref={buttonRef}
                data-attachment-button
                onClick={() => {
                  // ✅ Check tier access before opening attachment menu
                  if (!canUseImage) {
                    showGenericUpgrade('image');
                    return;
                  }
                  
                  if (!menuOpen) {
                    // 📱 Close the keyboard before opening menu (prevents overlap)
                    if (inputRef.current) {
                      inputRef.current.blur();
                    }
                  } else {
                    // Optionally, refocus input when closing the menu
                    setTimeout(() => {
                      if (inputRef.current) {
                        inputRef.current.focus();
                      }
                    }, 200);
                  }
                  
                  setMenuOpen(!menuOpen)
                }}
                disabled={disabled}
                className={`h-[44px] w-[44px] p-2 rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg touch-manipulation flex items-center justify-center flex-shrink-0 ${
                  menuOpen 
                    ? 'bg-atlas-sage text-gray-800' 
                    : 'bg-atlas-peach hover:bg-atlas-sage text-gray-800'
                }`}
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: menuOpen 
                    ? '0 4px 12px rgba(211, 220, 171, 0.4), inset 0 -2px 4px rgba(151, 134, 113, 0.15)'
                    : '0 2px 8px rgba(151, 134, 113, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                }}
                title="Add attachment"
                aria-label="Add attachment"
              >
                <Plus size={18} className={`transition-transform duration-300 ${menuOpen ? 'rotate-45' : 'rotate-0'}`} />
              </motion.button>

          {/* Attachment Menu */}
          {menuOpen && (
            <AttachmentMenu
              isOpen={menuOpen}
              onClose={() => {
                setMenuOpen(false)
                // Refocus input when closing the menu
                setTimeout(() => {
                  if (inputRef.current) {
                    inputRef.current.focus();
                  }
                }, 200);
              }}
              userId={user?.id || ""}
              onAddAttachment={handleAddAttachment}
            />
          )}
        </div>

            {/* Text Input - ✅ BEST PRACTICE: Proper flex with min-width 0 to prevent overflow */}
            <div className="flex-1 flex flex-col min-w-0">
              <textarea
                ref={inputRef as React.LegacyRef<HTMLTextAreaElement>}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyPress}
                onClick={() => {
                  // 📱 Focus the input to open keyboard ONLY
                  if (inputRef.current) {
                    inputRef.current.focus();
                  }
                }}
                onBlur={handleInputBlur}
                onFocus={handleInputFocus}
                placeholder={
                  attachmentPreviews.length > 0 
                    ? (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches ? "Add a caption..." : "Add a caption (optional)...")
                    : placeholder
                }
                className="flex-1 w-full bg-transparent sm:bg-white/95 text-gray-900 placeholder-atlas-text-muted focus:outline-none focus:ring-2 focus:ring-atlas-sage/50 border border-atlas-sand rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 resize-none min-h-[44px] max-h-[120px] transition-all duration-200 ease-in-out shadow-sm"
                style={{ fontSize: '16px', borderRadius: '16px' }} // Prevent iOS zoom + extra rounded
                disabled={isProcessing || disabled}
                autoComplete="off"
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck="true"
                rows={1}
              />
              {/* Character Counter - Only show when >80% used (professional, non-distracting) */}
              {showCounter && (
                <div className={`text-right text-xs px-3 pb-1 ${
                  percentUsed > 95 ? 'text-red-500' : 'text-amber-500'
                }`}>
                  {maxLength - currentLength} characters remaining
                </div>
              )}
            </div>

        {/* Action Buttons - ✅ BEST PRACTICE: Fixed sizes, proper spacing, no overflow */}
        <div className="flex items-center gap-2 flex-shrink-0">
              {/* ✅ SINGLE MICROPHONE BUTTON: Only for Core and Studio tiers */}
              {isVoiceSupported && canUseAudio && (tier === 'core' || tier === 'studio') && (
              <motion.button
                key="voice-recording-button"
                ref={micButtonRef}
                onClick={handleMicPress}
                onMouseDown={handleMicPressStart}
                onMouseUp={handleMicPressEnd}
                onMouseLeave={handleMicPressEnd}
                onTouchStart={handleMicPressStart}
                onTouchEnd={handleMicPressEnd}
                onTouchMove={handleMicPressMove}
                disabled={isProcessing || disabled}
                className={`h-[44px] w-[44px] p-2 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg touch-manipulation flex items-center justify-center relative flex-shrink-0 ${
                  isListening
                    ? 'bg-red-500/90 hover:bg-red-600 text-white'
                    : isPressHoldActive
                    ? 'bg-red-400/70 text-white scale-95'
                    : 'bg-atlas-sand hover:bg-atlas-stone text-gray-700'
                }`}
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: isListening 
                    ? '0 0 0 4px rgba(239, 68, 68, 0.3), 0 4px 12px rgba(239, 68, 68, 0.4)' 
                    : isPressHoldActive
                    ? '0 0 0 2px rgba(239, 68, 68, 0.2)'
                    : '0 4px 16px rgba(255, 255, 255, 0.3), inset 0 -2px 4px rgba(151, 134, 113, 0.1)'
                }}
                title={
                  isListening 
                    ? `Recording... ${formatTime(recordingDuration)}. Tap or release to stop`
                    : 'Tap to record or hold for press-and-hold mode'
                }
                aria-label={
                  isListening 
                    ? `Recording, ${formatTime(recordingDuration)}. Tap or release to stop`
                    : 'Tap to start recording voice message, or hold for press-and-hold mode'
                }
                aria-pressed={isListening}
              >
                {/* ✅ IMPROVED: Pulsing animation when recording */}
                {isListening && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-red-500/30"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                )}
                
                {/* ✅ IMPROVED: Show recording duration on button when active */}
                {isListening ? (
                  <span className="text-white font-mono text-xs font-semibold z-10">
                    {formatTime(recordingDuration)}
                      </span>
                ) : (
                  <Mic size={18} className="relative z-10" />
                )}
                
                {/* ✅ IMPROVED: Slide-to-cancel indicator (shows when sliding during hold) */}
                {isListening && slideCancelDistance > 20 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap z-20"
                  >
                    ↑ Slide up to cancel
                  </motion.div>
                )}
              </motion.button>
              )}

              {/* ✅ SINGLE SEND BUTTON: ✅ FIXED: Fixed size prevents cutoff */}
              <motion.button
                key="send-button"
                onClick={() => {
                  if ('vibrate' in navigator) {
                    navigator.vibrate(isStreaming ? 40 : 20);
                  }
                  isStreaming ? stopMessageStream() : handleSend();
                }}
                disabled={disabled || (!isStreaming && !text.trim() && attachmentPreviews.length === 0)}
                title={isStreaming ? "Stop Generation" : (attachmentPreviews.length > 0 ? `Send ${attachmentPreviews.length} attachment${attachmentPreviews.length > 1 ? 's' : ''}` : "Send message")}
                whileTap={{ scale: 0.95 }}
                className={`h-[44px] w-[44px] rounded-full flex items-center justify-center transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg touch-manipulation flex-shrink-0 ${
                  isStreaming 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : (text.trim() || attachmentPreviews.length > 0)
                    ? 'bg-atlas-sage hover:bg-atlas-stone text-gray-800'
                    : 'bg-atlas-sand/50 text-gray-500'
                }`}
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: isStreaming 
                    ? '0 4px 16px rgba(239, 68, 68, 0.5)' 
                    : (text.trim() || attachmentPreviews.length > 0)
                    ? '0 4px 16px rgba(255, 255, 255, 0.3), inset 0 -2px 4px rgba(151, 134, 113, 0.15)'
                    : '0 2px 8px rgba(255, 255, 255, 0.2)'
                }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isStreaming ? (
                    <motion.div
                      key="stop"
                      initial={{ opacity: 0, scale: 0.8, rotate: -90 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.8, rotate: 90 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                      <Square className="w-4 h-4 text-white" fill="white" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="send"
                      initial={{ opacity: 0, scale: 0.8, rotate: -90 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.8, rotate: 90 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                      <Send className={`w-4 h-4 ${(text.trim() || attachmentPreviews.length > 0) ? 'text-gray-800' : 'text-gray-500'}`} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
        </div>
      </motion.div>

      {/* ✅ REMOVED: Voice Call Modal (call button removed per user request) */}
      
      {/* ✅ PRIVACY NOTICE: Show on first use */}
      {showPrivacyNotice && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 max-w-sm"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Mic className="w-5 h-5 text-atlas-sand" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                    Voice Recording Privacy
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
                    Your voice recordings are processed and transcribed immediately. Audio is not stored permanently. 
                    <a 
                      href="/privacy" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-atlas-sand hover:underline ml-1"
                    >
                      Learn more
                    </a>
                  </p>
                  <button
                    onClick={() => {
                      localStorage.setItem('atlas-voice-privacy-notice-seen', 'true');
                      setShowPrivacyNotice(false);
                    }}
                    className="w-full px-3 py-1.5 bg-atlas-sand hover:bg-atlas-stone text-white text-xs font-medium rounded-md transition-colors"
                  >
                    Got it
                  </button>
                </div>
                <button
                  onClick={() => {
                    localStorage.setItem('atlas-voice-privacy-notice-seen', 'true');
                    setShowPrivacyNotice(false);
                  }}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
}
