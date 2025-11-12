import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, FileText, Image, Loader2, Mic, Music, Plus, Send, Square, X, XCircle } from 'lucide-react';
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
import { validateImageFile } from '../../utils/imageCompression';
import { imageService } from '../../services/imageService';
import { validateFile, getFileTypeName, getFileTypeCategory } from '../../utils/fileValidation';
import { fileService } from '../../services/fileService';
import AttachmentMenu from './AttachmentMenu';

// ✅ DEBUG: Conditional logging (dev only)
const isDev = import.meta.env.DEV;
const debugLog = (...args: any[]) => isDev && console.log(...args);

// ✅ CRITICAL: Module-level log to verify code is loaded
debugLog('[EnhancedInputToolbar] 📦 MODULE LOADED - Code is in bundle');

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
  // ✅ CRITICAL: Log at component start to verify it's rendering
  debugLog('[EnhancedInputToolbar] 🎬 COMPONENT RENDERED', { isVisible, disabled, isProcessing });
  
  const { user } = useSupabaseAuth();
  const { tier } = useTierAccess();
  // ✅ REMOVED: canUseVoice (call button removed)
  const { canUse: canUseImage, attemptFeature: attemptImage } = useFeatureAccess('image');
  const { canUse: canUseAudio, attemptFeature: attemptAudio } = useFeatureAccess('audio'); // ✅ Add audio feature access
  const { showGenericUpgrade } = useUpgradeModals();
  
  // ✅ REMOVED: isStudioTier check (call button removed)
  
  // Upgrade modal handler (from useTierAccess hook)
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false); // ✅ NEW: Processing state after recording
  const [attachmentPreviews, setAttachmentPreviews] = useState<any[]>([]);
  // ✅ REMOVED: Voice call state (call button removed per user request)
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'pending' | 'uploading' | 'processing' | 'success' | 'error'>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef(false); // ✅ CRITICAL: Prevent message send when cancelled
  const previewUrlsRef = useRef<Set<string>>(new Set()); // ✅ Track preview URLs for cleanup
  
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

  // ✅ CRITICAL: Completely hide vercel-live-feedback to prevent blocking
  useEffect(() => {
    const hideVercelFeedback = () => {
      const vercelFeedback = document.querySelector('vercel-live-feedback') as HTMLElement | null;
      if (vercelFeedback) {
        // ✅ CRITICAL: Try to remove it entirely first (most aggressive)
        try {
          vercelFeedback.remove();
          debugLog('[EnhancedInputToolbar] ✅ Removed vercel-live-feedback from DOM');
          return;
        } catch (e) {
          // If removal fails (shadow DOM), hide it completely
        }
        // ✅ Fallback: Use inert + hide completely
        vercelFeedback.setAttribute('inert', '');
        vercelFeedback.style.display = 'none';
        vercelFeedback.style.visibility = 'hidden';
        vercelFeedback.style.pointerEvents = 'none';
        vercelFeedback.style.opacity = '0';
        vercelFeedback.style.position = 'fixed';
        vercelFeedback.style.top = '-9999px';
        vercelFeedback.style.left = '-9999px';
        vercelFeedback.style.width = '0';
        vercelFeedback.style.height = '0';
        vercelFeedback.style.zIndex = '-1';
        vercelFeedback.removeAttribute('aria-hidden');
        debugLog('[EnhancedInputToolbar] ✅ Hid vercel-live-feedback (removal failed)');
      }
    };
    
    // Hide immediately
    hideVercelFeedback();
    
    // Also hide after delays (in case it loads later)
    const timers = [
      setTimeout(hideVercelFeedback, 100),
      setTimeout(hideVercelFeedback, 500),
      setTimeout(hideVercelFeedback, 1000),
    ];
    
    // Use MutationObserver to catch it if it's added dynamically
    const observer = new MutationObserver(() => {
      hideVercelFeedback();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    // ✅ DEBUG: Add global click listener to see if ANY clicks are registering
    const globalClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest('[data-attachment-button]')) {
        debugLog('[EnhancedInputToolbar] 🌍 GLOBAL CLICK DETECTED on attachment button');
        debugLog('[EnhancedInputToolbar] Event target:', target);
        debugLog('[EnhancedInputToolbar] Event path:', e.composedPath());
      }
    };
    document.addEventListener('click', globalClickHandler, true); // Use capture phase
    
    debugLog('[EnhancedInputToolbar] 🚀 Component mounted and listeners attached');
    
    // Cleanup
    return () => {
      timers.forEach(t => clearTimeout(t));
      observer.disconnect();
      document.removeEventListener('click', globalClickHandler, true);
    };
  }, []);

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

  // ✅ Cleanup timers and preview URLs on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (pressHoldTimerRef.current) {
        clearTimeout(pressHoldTimerRef.current);
      }
      
      // ✅ CLEANUP: Revoke all preview URLs on unmount to prevent memory leaks
      previewUrlsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          // Ignore errors when revoking (URL might already be revoked)
          logger.debug('[EnhancedInputToolbar] Error revoking URL on unmount:', error);
        }
      });
      previewUrlsRef.current.clear();
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
    
    // ✅ DON'T revoke preview URLs yet - wait until upload succeeds
    // If upload fails, we need to keep preview URLs for retry
    
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
      // Set processing state for floating indicator
      setIsUploading(true);
      
      try {
        // ✅ CRITICAL: Upload files first to get HTTP/HTTPS URLs (backend requires HTTP/HTTPS, not blob URLs)
        logger.debug('[EnhancedInputToolbar] 📤 Uploading files before sending...');
        
        const uploadedAttachments = await Promise.all(
          currentAttachments.map(async (att) => {
            // Update status to uploading
            if (att.id) {
              setUploadStatus(prev => ({ ...prev, [att.id!]: 'uploading' as const }));
            }
            
            // If file exists and we don't have a publicUrl yet, upload it
            if (att.file && !att.publicUrl && (!att.url || att.url.startsWith('blob:'))) {
              try {
                if (!user?.id) {
                  throw new Error('User ID required for upload');
                }
                
                logger.debug('[EnhancedInputToolbar] Uploading file:', att.file.name);
                
                // Use appropriate service based on attachment type
                let uploadResult;
                if (att.type === 'file') {
                  uploadResult = await fileService.uploadFile(att.file, user.id);
                } else {
                  uploadResult = await imageService.uploadImage(att.file, user.id);
                }
                
                // Update status to processing
                if (att.id) {
                  setUploadStatus(prev => ({ ...prev, [att.id!]: 'processing' as const }));
                }
                
                return {
                  id: att.id,
                  type: att.type,
                  url: uploadResult.publicUrl,
                  publicUrl: uploadResult.publicUrl,
                  name: att.name || att.file.name
                };
              } catch (uploadError) {
                logger.error('[EnhancedInputToolbar] Upload failed for attachment:', uploadError);
                // Update status to error
                if (att.id) {
                  setUploadStatus(prev => ({ ...prev, [att.id!]: 'error' as const }));
                }
                throw uploadError;
              }
            }
            
            // Already uploaded, use existing URL
            return {
              id: att.id,
              type: att.type,
              url: att.publicUrl || att.url,
              publicUrl: att.publicUrl || att.url,
              name: att.name
            };
          })
        );
        
        logger.debug('[EnhancedInputToolbar] ✅ Files uploaded, sending message...');
        
        // Use Promise.race for timeout protection (increased timeout for image analysis)
        if (addMessage) {
          await Promise.race([
            sendMessageWithAttachments(conversationId || '', uploadedAttachments, addMessage, currentText || undefined, user?.id),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Send timeout')), 15000) // Reduced from 30000ms for better mobile UX
            )
          ]);
        }
        
        logger.debug('[EnhancedInputToolbar] ✅ sendMessageWithAttachments completed');
        
        // ✅ CLEANUP: Now safe to revoke preview URLs after successful upload
        currentAttachments.forEach(att => {
          const previewUrl = att.previewUrl || att.url;
          if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
            previewUrlsRef.current.delete(previewUrl);
          }
        });
        
        // Update status to success
        uploadedAttachments.forEach((att: { id?: string; type: string; url?: string }) => {
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
        
        // Update status to error (use currentAttachments, not undefined 'attachments')
        currentAttachments.forEach((att: { id?: string; type: string; url?: string }) => {
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
  const handleAddAttachment = (attachment: { id: string; type: string; url?: string; publicUrl?: string; file?: File; previewUrl?: string; name?: string }) => {
    const attachmentWithId = {
      ...attachment,
      id: attachment.id || generateUUID() // Ensure it has an ID
    };
    
    // ✅ Track preview URL for cleanup
    if (attachment.previewUrl || attachment.url) {
      const previewUrl = attachment.previewUrl || attachment.url!;
      previewUrlsRef.current.add(previewUrl);
    }
    
    setAttachmentPreviews(prev => [...prev, attachmentWithId]);
    
    // ✅ Set status to 'pending' (file selected but not uploaded yet)
    setUploadStatus(prev => ({ ...prev, [attachmentWithId.id]: 'pending' }));
    
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
    // ✅ Cleanup preview URL when removing attachment
    const attachment = attachmentPreviews.find(att => att.id === attachmentId);
    if (attachment) {
      const previewUrl = attachment.previewUrl || attachment.url;
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
        previewUrlsRef.current.delete(previewUrl);
      }
    }
    
    setAttachmentPreviews(prev => prev.filter(att => att.id !== attachmentId));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };



  // 📱 Handle input blur to minimize when clicking outside (ChatGPT-like behavior)
  const handleInputBlur = () => {
    // Small delay to allow for interactions
    setTimeout(() => {
      if (inputRef.current) {
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
    
    // ✅ CRITICAL: Set cancellation flag BEFORE stopping to prevent message send
    isCancelledRef.current = true;
    
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
    setIsProcessingAudio(false); // ✅ FIX: Clear processing state
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

    // ✅ CRITICAL: Reset cancellation flag for new recording
    isCancelledRef.current = false;

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
            // ✅ CRITICAL: Exit early if cancelled - prevents message send
            if (isCancelledRef.current) {
              isCancelledRef.current = false; // Reset for next recording
              return; // Don't process or send message
            }
            
            setIsListening(false);
            setIsProcessingAudio(true); // ✅ NEW: Show processing state
            
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
            // 🎯 Transcribe audio and send immediately (ChatGPT-style)
            const transcript = await voiceService.recordAndTranscribe(audioBlob, tier as 'free' | 'core' | 'studio');
            
            // Auto-send the transcribed message
            if (transcript && transcript.trim()) {
              // Send immediately
              onSendMessage(transcript);
            } else {
              modernToast.error('No Speech Detected', 'Please speak clearly and try again');
            }
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to process voice message';
            modernToast.error('Transcription Failed', errorMessage);
            setIsProcessingAudio(false); // ✅ FIX: Clear processing state on error
          } finally {
            setIsListening(false);
            setIsProcessingAudio(false); // ✅ NEW: Clear processing state
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
            isCancelledRef.current = false; // ✅ Reset flag
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
        // ✅ REMOVED: Toast notification (floating overlay shows processing state)
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
              const status = uploadStatus[attachment.id] || 'pending';
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
                    {attachment.type === 'file' && attachment.file && (
                      <div className="relative w-8 h-8 rounded-lg bg-atlas-sage/20 flex items-center justify-center">
                        {(() => {
                          const category = getFileTypeCategory(attachment.file);
                          if (category === 'audio') {
                            return <Music className="w-4 h-4 text-atlas-sage" />;
                          }
                          return <FileText className="w-4 h-4 text-atlas-sage" />;
                        })()}
                      </div>
                    )}
                    {attachment.type === 'file' && !attachment.file && (
                      <FileText className="w-4 h-4 text-neutral-400" />
                    )}
                    {attachment.type === 'image' && (
                      <Image className="w-4 h-4 text-neutral-400" />
                    )}
                    <span className="text-sm text-neutral-200 truncate">
                      {attachment.type === 'file' && attachment.file
                        ? getFileTypeName(attachment.file)
                        : attachment.name || attachment.file?.name || (attachment.type === 'image' ? 'Image' : 'File')}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {status === 'pending' && (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-blue-400">Ready</span>
                      </>
                    )}
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
                        <span className="text-xs text-green-400">Sent</span>
                      </>
                    )}
                    {status === 'error' && (
                      <>
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span className="text-xs text-red-400">Failed</span>
                        <button
                          onClick={async () => {
                            // ✅ RETRY: Re-upload and send this specific attachment
                            const att = attachmentPreviews.find(a => a.id === attachment.id);
                            if (!att?.file || !user?.id) return;
                            
                            // Update status to uploading
                            setUploadStatus(prev => ({ ...prev, [attachment.id]: 'uploading' }));
                            
                            try {
                              // Upload the file
                              const uploadResult = await imageService.uploadImage(att.file, user.id);
                              
                              // Update attachment with uploaded URL
                              setAttachmentPreviews(prev => prev.map(a => 
                                a.id === attachment.id 
                                  ? { ...a, url: uploadResult.publicUrl, publicUrl: uploadResult.publicUrl }
                                  : a
                              ));
                              
                              // Update status to processing
                              setUploadStatus(prev => ({ ...prev, [attachment.id]: 'processing' }));
                              
                              // Send message with this attachment
                              const updatedAttachments = [{
                                id: attachment.id,
                                type: att.type,
                                url: uploadResult.publicUrl,
                                publicUrl: uploadResult.publicUrl,
                                name: att.name || att.file.name
                              }];
                              
                              if (addMessage) {
                                await sendMessageWithAttachments(
                                  conversationId || '',
                                  updatedAttachments,
                                  addMessage,
                                  text.trim() || undefined,
                                  user.id
                                );
                              }
                              
                              // Success - remove from previews
                              setAttachmentPreviews(prev => prev.filter(a => a.id !== attachment.id));
                              setUploadStatus(prev => {
                                const next = { ...prev };
                                delete next[attachment.id];
                                return next;
                              });
                            } catch (retryError) {
                              logger.error('[EnhancedInputToolbar] Retry failed:', retryError);
                              setUploadStatus(prev => ({ ...prev, [attachment.id]: 'error' }));
                              modernToast.error(
                                'Retry Failed',
                                retryError instanceof Error ? retryError.message : 'Could not retry upload. Please try again.'
                              );
                            }
                          }}
                          className="ml-2 text-xs text-atlas-sage underline hover:opacity-80 transition-opacity"
                          title="Retry upload"
                          aria-label="Retry upload"
                        >
                          Retry
                        </button>
                      </>
                    )}
                    
                    <button
                      onClick={() => removeAttachment(attachment.id)}
                      className="p-1 rounded-full hover:bg-white/10 transition-colors"
                      title="Remove attachment"
                      aria-label="Remove attachment"
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
      {/* ✅ PROFESSIONAL RECORDING INDICATOR: Enhanced floating overlay (WhatsApp/Telegram-style) */}
      {(isListening || isProcessingAudio) && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-24 sm:bottom-28 left-0 right-0 flex justify-center z-[9999] px-4 pointer-events-auto"
        >
          <div className={`flex items-center space-x-3 rounded-full px-6 py-3.5 shadow-2xl border backdrop-blur-md ${
            isProcessingAudio 
              ? 'bg-blue-500/95 border-blue-400/50' 
              : 'bg-red-500/95 border-red-400/50'
          }`}>
            {/* ✅ IMPROVED: Pulsing animation - more professional */}
            {isListening && (
              <div className="relative flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                <div className="absolute w-3 h-3 bg-white rounded-full animate-ping"></div>
              </div>
            )}
            
            {/* ✅ IMPROVED: Processing spinner */}
            {isProcessingAudio && (
              <div className="relative flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            {/* ✅ IMPROVED: Clear status text */}
            <span className="text-white font-medium text-sm sm:text-base whitespace-nowrap">
              {isProcessingAudio 
                ? 'Processing...' 
                : `Recording • ${formatTime(recordingDuration)}`
              }
            </span>
            
            {/* ✅ IMPROVED: Cancel button - only show when recording (not processing) */}
            {isListening && (
              <button
                onClick={handleCancelRecording}
                className="ml-2 p-1.5 rounded-full hover:bg-white/20 active:bg-white/30 transition-colors touch-manipulation"
                title="Cancel recording"
                aria-label="Cancel recording"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        </motion.div>
      )}
      
      {/* ✅ UNIFIED INPUT BAR: Mobile floating overlay + Desktop static footer */}
      <motion.div 
        data-input-area
        className="
          unified-input-bar
          flex items-center w-full max-w-4xl mx-auto px-2 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4 
          rounded-[2rem] sm:rounded-[2rem]
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
        <div 
          className="relative flex-shrink-0"
          style={{
            zIndex: 2147483647, // ✅ Maximum z-index for parent container
            isolation: 'isolate', // ✅ Create new stacking context
            position: 'relative',
          }}
        >
              {/* Hidden file inputs */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = '';
                  
                  try {
                    const validation = await validateImageFile(file);
                    if (!validation.valid) {
                      modernToast.error('Invalid Image', validation.error || 'Please select a valid image file.');
                      return;
                    }
                  } catch (error) {
                    logger.error('[EnhancedInputToolbar] Validation error:', error);
                    modernToast.error('Validation Error', 'Failed to validate image. Please try again.');
                    return;
                  }
                  
                  const previewUrl = URL.createObjectURL(file);
                  handleAddAttachment({
                    id: generateUUID(),
                    type: 'image',
                    file,
                    name: file.name,
                    url: previewUrl,
                    previewUrl: previewUrl,
                  });
                }}
              />
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.mp3,.mp4"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = '';
                  
                  try {
                    const validation = await validateFile(file);
                    if (!validation.valid) {
                      modernToast.error('Invalid File', validation.error || 'Please select a valid file.');
                      return;
                    }
                  } catch (error) {
                    logger.error('[EnhancedInputToolbar] Validation error:', error);
                    modernToast.error('Validation Error', 'Failed to validate file. Please try again.');
                    return;
                  }
                  
                  handleAddAttachment({
                    id: generateUUID(),
                    type: 'file',
                    file,
                    name: file.name,
                  });
                }}
              />
              
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = '';
                  
                  try {
                    const validation = await validateImageFile(file);
                    if (!validation.valid) {
                      modernToast.error('Invalid Image', validation.error || 'Please select a valid image file.');
                      return;
                    }
                  } catch (error) {
                    logger.error('[EnhancedInputToolbar] Validation error:', error);
                    modernToast.error('Validation Error', 'Failed to validate image. Please try again.');
                    return;
                  }
                  
                  const previewUrl = URL.createObjectURL(file);
                  handleAddAttachment({
                    id: generateUUID(),
                    type: 'image',
                    file,
                    name: file.name,
                    url: previewUrl,
                    previewUrl: previewUrl,
                  });
                }}
              />
              
              <motion.button
                ref={buttonRef}
                data-attachment-button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }}
                disabled={isUploading || isProcessing}
                className={`h-[44px] w-[44px] p-2 rounded-full transition-all duration-200 shadow-md hover:shadow-lg touch-manipulation flex items-center justify-center flex-shrink-0 bg-atlas-peach hover:bg-atlas-peach/40 sm:hover:bg-atlas-sage text-gray-800 ${isUploading ? 'cursor-wait' : 'cursor-pointer'}`}
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  pointerEvents: 'auto',
                  position: 'relative',
                }}
                title="Add attachment"
                aria-label="Add attachment"
              >
                <Plus size={18} className="transition-all duration-200" />
              </motion.button>
              
              {/* Attachment Menu */}
              {user?.id && (
                <AttachmentMenu
                  isOpen={isMenuOpen}
                  onClose={() => setIsMenuOpen(false)}
                  userId={user.id}
                  onAddAttachment={handleAddAttachment}
                  imageInputRef={imageInputRef}
                  fileInputRef={fileInputRef}
                  cameraInputRef={cameraInputRef}
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
              {/* ✅ PROFESSIONAL MICROPHONE BUTTON: Enhanced UX with clear states */}
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
                disabled={isProcessing || disabled || isProcessingAudio}
                className={`h-[44px] w-[44px] p-2 rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg touch-manipulation flex items-center justify-center relative flex-shrink-0 ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : isProcessingAudio
                    ? 'bg-blue-500 text-white'
                    : isPressHoldActive
                    ? 'bg-red-400 text-white scale-95'
                    : 'bg-atlas-sand hover:bg-atlas-stone text-gray-700'
                }`}
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: isListening 
                    ? '0 0 0 4px rgba(239, 68, 68, 0.3), 0 4px 12px rgba(239, 68, 68, 0.4)' 
                    : isProcessingAudio
                    ? '0 0 0 4px rgba(59, 130, 246, 0.3), 0 4px 12px rgba(59, 130, 246, 0.4)'
                    : isPressHoldActive
                    ? '0 0 0 2px rgba(239, 68, 68, 0.2)'
                    : '0 2px 8px rgba(151, 134, 113, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
                }}
                title={
                  isProcessingAudio
                    ? 'Processing audio...'
                    : isListening 
                    ? `Recording... Tap to stop`
                    : 'Tap to record voice message'
                }
                aria-label={
                  isProcessingAudio
                    ? 'Processing audio, please wait'
                    : isListening 
                    ? `Recording, tap to stop`
                    : 'Tap to start recording voice message'
                }
                aria-pressed={isListening}
                aria-busy={isProcessingAudio}
              >
                {/* ✅ IMPROVED: Subtle pulsing animation when recording (more professional) */}
                {isListening && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-red-500/20"
                    animate={{
                      scale: [1, 1.15, 1],
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                )}
                
                {/* ✅ IMPROVED: Processing spinner */}
                {isProcessingAudio ? (
                  <motion.div
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                ) : (
                  <Mic size={18} className="relative z-10" />
                )}
                
                {/* ✅ IMPROVED: Slide-to-cancel indicator (more visible) */}
                {isListening && slideCancelDistance > 20 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-14 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-xs px-4 py-2 rounded-lg shadow-xl whitespace-nowrap z-20 font-medium"
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
                className={`h-[44px] w-[44px] rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg touch-manipulation flex-shrink-0 ${isUploading ? 'cursor-wait' : ''} ${
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
                      <Send className={`w-4 h-4 transition-all duration-200 ${(text.trim() || attachmentPreviews.length > 0) ? 'text-gray-800' : 'text-gray-500'}`} />
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
