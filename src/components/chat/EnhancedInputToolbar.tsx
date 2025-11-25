import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, FileText, Image, Loader2, Mic, Music, Plus, Send, Square, X, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { modernToast } from '../../config/toastConfig';
import { useUpgradeModals } from '../../contexts/UpgradeModalContext';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useFeatureAccess, useTierAccess } from '../../hooks/useTierAccess';
import { sendMessageWithAttachments, stopMessageStream } from '../../services/chatService';
import '../../styles/voice-animations.css';
import type { Message } from '../../types/chat';
// Removed useMessageStore import - using props from parent component
import { logger } from '../../lib/logger';
import { fileService } from '../../services/fileService';
import { imageService } from '../../services/imageService';
import { isAudioRecordingSupported } from '../../utils/audioHelpers';
import { getFileTypeCategory, getFileTypeName, validateFile } from '../../utils/fileValidation';
import { validateImageFile } from '../../utils/imageCompression';
import { generateUUID } from '../../utils/uuid';
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
  isStreaming?: boolean;
}

// ✅ PERFORMANCE FIX: Memoized component to prevent unnecessary re-renders
const EnhancedInputToolbar = React.memo(({
  onSendMessage,
  isProcessing = false,
  disabled = false,
  placeholder = "Ask anything...",
  conversationId,
  inputRef: externalInputRef,
  isVisible = true,
  onSoundPlay,
  isStreaming = false
}: EnhancedInputToolbarProps) => {
  // ✅ CRITICAL: Log at component start to verify it's rendering
  debugLog('[EnhancedInputToolbar] 🎬 COMPONENT RENDERED', { isVisible, disabled, isProcessing });
  
  const { user } = useSupabaseAuth();
  const { tier } = useTierAccess();
  // ✅ REMOVED: canUseVoice (call button removed)
  const { canUse: canUseImage, attemptFeature: attemptImage } = useFeatureAccess('image');
  const { canUse: canUseAudio, attemptFeature: attemptAudio } = useFeatureAccess('audio'); // ✅ Add audio feature access
  const { canUse: canUseCamera, attemptFeature: attemptCamera } = useFeatureAccess('camera'); // ✅ SECURITY FIX: Add camera access check
  const { canUse: canUseFile, attemptFeature: attemptFile } = useFeatureAccess('file'); // ✅ Add file feature access
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
  // ✅ REMOVED: showCaptionInput state - always show input when attachments exist (cleaner UX)
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
    let timer: NodeJS.Timeout | null = null;
    
    if (!hasSeenPrivacyNotice && supported) {
      // Show privacy notice after a short delay (not immediately)
      timer = setTimeout(() => {
        setShowPrivacyNotice(true);
      }, 2000);
    }
    
    // ✅ CRITICAL FIX: Always return cleanup function (prevents React Error #310)
    // React requires hooks to always return the same type (cleanup function or undefined)
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
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

  // ✅ CRITICAL FIX: Clear draft attachments when conversation changes
  useEffect(() => {
    // Clear attachments when switching conversations
    if (attachmentPreviews.length > 0) {
      // Cleanup preview URLs
      attachmentPreviews.forEach(att => {
        const previewUrl = att.previewUrl || att.url;
        if (previewUrl && previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
          previewUrlsRef.current.delete(previewUrl);
        }
      });
      setAttachmentPreviews([]);
      setText('');
    }
    
    // ✅ CRITICAL FIX: Always return cleanup function (prevents React Error #310)
    return () => {
      // No cleanup needed, but React requires consistent return type
    };
  }, [conversationId]); // Only run when conversationId changes

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
    
    // ✅ CRITICAL FIX: Always return cleanup function (prevents React Error #310)
    return () => {
      // No cleanup needed, but React requires consistent return type
    };
  }, [isVisible]);

  // ✅ Auto-expand textarea as user types (ChatGPT-style) - FIXED
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) {
      // ✅ CRITICAL FIX: Always return cleanup function (prevents React Error #310)
      // React requires hooks to always return the same type (cleanup function or undefined)
      return () => {};
    }

    requestAnimationFrame(() => {
      // Reset to natural height first
      textarea.style.height = 'auto';
      
      const minHeight = 56;   // matches min-h-[56px]
      const maxHeight = 120;  // MUST match CSS max
      const contentHeight = textarea.scrollHeight;
      
      const finalHeight = Math.max(minHeight, Math.min(contentHeight, maxHeight));
      textarea.style.height = finalHeight + 'px';
      textarea.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
    });
    
    // ✅ CRITICAL FIX: Always return cleanup function (prevents React Error #310)
    return () => {
      // No cleanup needed, but React requires consistent return type
    };
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

  // ✅ PERFORMANCE FIX: Memoize computed values to prevent recalculation on every render
  const maxLength = useMemo(() => TIER_LIMITS[tier] || TIER_LIMITS.free, [tier]);
  const currentLength = text.length;
  const percentUsed = useMemo(() => maxLength > 0 ? (currentLength / maxLength) * 100 : 0, [currentLength, maxLength]);
  const showCounter = useMemo(() => percentUsed > 80, [percentUsed]); // Only show when >80% used (professional, non-distracting)

  // ✅ PERFORMANCE FIX: Memoize callback to prevent child re-renders
  const handleSend = useCallback(async () => {
    if (isProcessing || disabled) return;
    
    // ✅ CRITICAL FIX: Don't clear attachments until upload succeeds
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
    
    // ✅ CRITICAL FIX: Validate total attachment size (prevent crashes on low-end devices)
    const totalSize = currentAttachments.reduce((sum, att) => sum + (att.file?.size || 0), 0);
    const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total limit
    if (totalSize > MAX_TOTAL_SIZE) {
      modernToast.error('Files Too Large', `Total size exceeds ${(MAX_TOTAL_SIZE / 1024 / 1024).toFixed(0)}MB limit. Please reduce file sizes.`);
      return;
    }
    
    // Show immediate feedback
    if (onSoundPlay) {
      onSoundPlay('send_message');
    }
    
    // 🎯 FUTURE-PROOF FIX: Send attachments even without conversationId (backend will create one)
    if (currentAttachments.length > 0) {
      // Set processing state for floating indicator
      setIsUploading(true);
      
      try {
        // ✅ CRITICAL FIX: Sequential upload with rollback on failure
        logger.debug('[EnhancedInputToolbar] 📤 Uploading files sequentially before sending...');
        
        const uploadedAttachments: Array<{ id?: string; type: string; url: string; publicUrl: string; name?: string }> = [];
        
        // Upload one at a time (safer, allows rollback)
        for (const att of currentAttachments) {
          // Update status to uploading
          if (att.id) {
            setUploadStatus(prev => ({ ...prev, [att.id!]: 'uploading' as const }));
          }
          
          // ✅ CRITICAL FIX: Check if already uploaded (voice notes are uploaded when added to draft)
          // If file exists and we don't have a publicUrl yet, upload it
          if (att.file && !att.publicUrl && (!att.url || att.url.startsWith('blob:'))) {
            try {
              if (!user?.id) {
                throw new Error('User ID required for upload');
              }
              
              logger.debug('[EnhancedInputToolbar] Uploading file:', att.file.name, 'type:', att.type);
              
              // Use appropriate service based on attachment type
              let uploadResult;
              if (att.type === 'audio') {
                // ✅ CRITICAL FIX: Use voiceService for audio uploads
                const { voiceService } = await import('../../services/voiceService');
                const audioMetadata = await voiceService.uploadAudio(att.file);
                uploadResult = { publicUrl: audioMetadata.url };
              } else if (att.type === 'file') {
                uploadResult = await fileService.uploadFile(att.file, user.id);
              } else {
                uploadResult = await imageService.uploadImage(att.file, user.id);
              }
              
              // Update status to processing
              if (att.id) {
                setUploadStatus(prev => ({ ...prev, [att.id!]: 'processing' as const }));
              }
              
              uploadedAttachments.push({
                id: att.id,
                type: att.type,
                url: uploadResult.publicUrl,
                publicUrl: uploadResult.publicUrl,
                name: att.name || att.file.name
              });
            } catch (uploadError) {
              logger.error('[EnhancedInputToolbar] Upload failed for attachment:', uploadError);
              // Update status to error
              if (att.id) {
                setUploadStatus(prev => ({ ...prev, [att.id!]: 'error' as const }));
              }
              
              // ✅ CRITICAL FIX: Rollback - restore attachments on failure
              setAttachmentPreviews(currentAttachments);
              setText(currentText);
              
              throw uploadError;
            }
          } else {
            // ✅ CRITICAL FIX: Already uploaded (voice notes are uploaded when added to draft)
            // Use existing URL (voice notes already have publicUrl from uploadAudio)
            uploadedAttachments.push({
              id: att.id,
              type: att.type,
              url: att.publicUrl || att.url || '',
              publicUrl: att.publicUrl || att.url || '',
              name: att.name
            });
          }
        }
        
        logger.debug('[EnhancedInputToolbar] ✅ Files uploaded, sending message...');
        
        // ✅ CRITICAL FIX: Only clear UI after successful upload
        // Temporarily disable transitions on textarea
        if (inputRef.current) {
          inputRef.current.style.transition = 'none';
        }
        
        setAttachmentPreviews([]);
        setText('');
        
        // Re-enable transitions after clearing
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.style.transition = '';
          }
        });
        
        // ✅ CRITICAL FIX: Match backend timeout (60s) to prevent premature timeouts
        // Backend image analysis timeout is 60s, so UI must match to avoid false "Send timeout" errors
        if (conversationId) {
          await Promise.race([
            sendMessageWithAttachments(conversationId, uploadedAttachments, undefined, currentText || undefined, user?.id),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Send timeout')), 60000) // ✅ FIX: Match backend 60s timeout
            )
          ]);
        }
        
        logger.debug('[EnhancedInputToolbar] ✅ sendMessageWithAttachments completed');
        
        // ✅ CRITICAL FIX: Clear attachments immediately on success (not after delay)
        // This prevents attachments from appearing "stuck" in UI
        setAttachmentPreviews([]);
        setText('');
        
        // ✅ CLEANUP: Now safe to revoke preview URLs after successful upload
        currentAttachments.forEach(att => {
          const previewUrl = att.previewUrl || att.url;
          if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
            previewUrlsRef.current.delete(previewUrl);
          }
        });
        
        // Update status to success (briefly, then clear)
        uploadedAttachments.forEach((att: { id?: string; type: string; url?: string }) => {
          if (att.id) {
            setUploadStatus(prev => ({ ...prev, [att.id!]: 'success' as const }));
          }
        });
        
        // Clear upload status immediately (no delay needed)
        setIsUploading(false);
        setUploadStatus({});
      } catch (error) {
        logger.error('[EnhancedInputToolbar] ❌ sendMessageWithAttachments failed:', error);
        
        // ✅ CRITICAL FIX: Rollback - restore attachments on failure (user can retry)
        setAttachmentPreviews(currentAttachments);
        setText(currentText);
        
        // Update status to error (so user can see "Failed" and retry)
        currentAttachments.forEach((att: { id?: string; type: string; url?: string }) => {
          if (att.id) {
            setUploadStatus(prev => ({ ...prev, [att.id!]: 'error' as const }));
          }
        });
        
        // More specific error messages
        if (error instanceof Error && error.message === 'Send timeout') {
          modernToast.error("Analysis Timeout", "Image analysis is taking longer than expected. The message may still be processing. Check back in a moment.");
        } else if (error instanceof Error) {
          modernToast.error("Upload Failed", error.message || "Could not send attachment. Please try again.");
        } else {
          modernToast.error("Upload Failed", "Could not send attachment. Please try again.");
        }
        
        // ✅ FIX: Clear uploading state immediately, but keep error status for retry UI
        setIsUploading(false);
        // Don't clear error status - let user see "Failed" and retry button
      }
    } else if (currentText) {
      // Regular text message - clear immediately
      setText('');
      onSendMessage(currentText);
    }
    
    // ✅ Refocus after sending if still visible
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [text, attachmentPreviews, isProcessing, disabled, maxLength, tier, onSoundPlay, conversationId, user?.id, isVisible, onSendMessage]);

  // ✅ PERFORMANCE FIX: Memoize callbacks to prevent child re-renders
  // Handle adding attachments to input area
  const handleAddAttachment = useCallback((attachment: { id: string; type: string; url?: string; publicUrl?: string; file?: File; previewUrl?: string; name?: string }) => {
    const attachmentWithId = {
      ...attachment,
      id: attachment.id || generateUUID() // Ensure it has an ID
    };
    
    // ✅ Track preview URL for cleanup
    if (attachment.previewUrl || attachment.url) {
      const previewUrl = attachment.previewUrl || attachment.url!;
      previewUrlsRef.current.add(previewUrl);
    }
    
    // ✅ CRITICAL FIX: Prevent duplicate attachment previews
    setAttachmentPreviews(prev => {
      const exists = prev.some(att => 
        att.url === attachmentWithId.url || 
        att.publicUrl === attachmentWithId.publicUrl ||
        (att.id === attachmentWithId.id)
      );
      return exists ? prev : [...prev, attachmentWithId];
    });
    
    // ✅ Set status to 'pending' (file selected but not uploaded yet)
    setUploadStatus(prev => ({ ...prev, [attachmentWithId.id]: 'pending' }));
    
    // Don't set isUploading here - let the upload cards handle the loading state
    
    // 🎯 FUTURE-PROOF FIX: Auto-focus input for caption
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  }, []); // Empty deps - uses refs and setState which are stable

  // ✅ PERFORMANCE FIX: Memoize callback to prevent child re-renders
  // Handle removing attachments from input area
  const removeAttachment = useCallback((attachmentId: string) => {
    // ✅ Cleanup preview URL when removing attachment
    setAttachmentPreviews(prev => {
      const attachment = prev.find(att => att.id === attachmentId);
      if (attachment) {
        const previewUrl = attachment.previewUrl || attachment.url;
        if (previewUrl && previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
          previewUrlsRef.current.delete(previewUrl);
        }
      }
      return prev.filter(att => att.id !== attachmentId);
    });
  }, []); // Empty deps - uses setState which is stable

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
            
            // ✅ CRITICAL FIX: Add audio to draft attachments instead of sending immediately
            // This allows users to combine image + voice note
            try {
              // Upload audio to get URL
              const { voiceService } = await import('../../services/voiceService');
              const audioMetadata = await voiceService.uploadAudio(audioBlob);
              
              // Add to draft attachments
              const audioAttachment = {
                id: generateUUID(),
                type: 'audio' as const,
                url: audioMetadata.url,
                publicUrl: audioMetadata.url,
                file: audioBlob,
                previewUrl: URL.createObjectURL(audioBlob), // Preview for UI
                name: `voice-note-${Date.now()}.webm`
              };
              
              handleAddAttachment(audioAttachment);
              
              // ✅ OPTIONAL: Auto-transcribe for caption (user can edit)
              try {
                const transcriptResult = await voiceService.transcribeAudio(audioMetadata.url);
                const transcript = transcriptResult.transcript;
                
                if (transcript && transcript.trim()) {
                  // ✅ BEST PRACTICE: Log STT transcript for debugging and transparency
                  logger.info('[EnhancedInputToolbar] 🎤 STT Transcript:', {
                    transcript: transcript,
                    audioUrl: audioMetadata.url,
                    confidence: transcriptResult.confidence,
                    duration: transcriptResult.duration,
                    language: transcriptResult.language
                  });
                  
                  // Set as caption text (user can edit before sending)
                  setText(transcript);
                }
              } catch (transcribeError) {
                // ✅ CRITICAL FIX: Transcription failed but audio is saved - don't show error toast
                // User can still send the voice note without transcription
                logger.warn('[EnhancedInputToolbar] Transcription failed, but audio saved:', transcribeError);
                // Don't show error toast - audio upload succeeded, transcription is optional
              }
              
              modernToast.success('Voice Note Added', 'You can add an image or send now');
            } catch (uploadError) {
              // ✅ CRITICAL FIX: Better error handling for upload failures
              const errorMessage = uploadError instanceof Error ? uploadError.message : 'Failed to save voice note';
              
              // Check if it's a network error
              if (errorMessage.includes('network') || errorMessage.includes('Failed to fetch') || errorMessage.includes('connection')) {
                logger.error('[EnhancedInputToolbar] Network error during audio upload:', uploadError);
                modernToast.error('Network Error', 'Please check your connection and try again');
              } else {
                logger.error('[EnhancedInputToolbar] Audio upload failed:', uploadError);
                modernToast.error('Upload Failed', errorMessage);
              }
              
              // Clean up attachment if upload failed
              setAttachmentPreviews(prev => prev.filter(att => att.id !== audioAttachment.id));
            } finally {
              setIsProcessingAudio(false);
            }
            
          } catch (error) {
            // ✅ CRITICAL FIX: Better error handling for recording failures
            const errorMessage = error instanceof Error ? error.message : 'Failed to process voice message';
            
            // Check error type for better user messaging
            if (errorMessage.includes('permission') || errorMessage.includes('microphone')) {
              logger.error('[EnhancedInputToolbar] Microphone permission error:', error);
              modernToast.error('Microphone Access', 'Please allow microphone access to record voice notes');
            } else if (errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
              logger.error('[EnhancedInputToolbar] Network error during recording:', error);
              modernToast.error('Network Error', 'Please check your connection and try again');
            } else {
              logger.error('[EnhancedInputToolbar] Recording failed:', error);
              modernToast.error('Recording Failed', errorMessage);
            }
            
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
          {/* ✅ FIX: Remove 'Add an optional caption below' hint */}
          
          <div className="flex flex-wrap gap-2 max-w-4xl mx-auto">
            {attachmentPreviews.map((attachment) => {
              const status = uploadStatus[attachment.id] || 'pending';
              return (
                <motion.div 
                  key={attachment.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center justify-between rounded-2xl bg-white/90 dark:bg-gray-800/90 border border-atlas-sand/30 dark:border-gray-700 p-2 mt-2 transition-all max-w-[90vw]"
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
                      <FileText className="w-4 h-4 text-neutral-400 dark:text-gray-500" />
                    )}
                    {attachment.type === 'image' && (
                      <Image className="w-4 h-4 text-neutral-400 dark:text-gray-500" />
                    )}
                    <span className="text-sm text-neutral-200 dark:text-gray-300 truncate">
                      {attachment.type === 'file' && attachment.file
                        ? getFileTypeName(attachment.file)
                        : attachment.name || attachment.file?.name || (attachment.type === 'image' ? 'Image' : 'File')}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* ✅ REMOVED: 'Ready' status - too busy, attachment preview is sufficient */}
                    {status === 'uploading' && (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-neutral-400 dark:text-gray-500" />
                        <span className="text-xs text-neutral-400 dark:text-gray-500">Uploading...</span>
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
                              
                              if (conversationId) {
                                await sendMessageWithAttachments(
                                  conversationId,
                                  updatedAttachments,
                                  undefined,
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
                      className="p-1 rounded-full hover:bg-white/10 dark:hover:bg-gray-700/50 transition-colors"
                      title="Remove attachment"
                      aria-label="Remove attachment"
                    >
                      <X className="w-4 h-4 text-neutral-400 dark:text-gray-500" />
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
              ? 'bg-white/95 dark:bg-gray-800/95 border-gray-300/50 dark:border-gray-600/50' 
              : 'bg-red-500/95 dark:bg-red-600/95 border-red-400/50 dark:border-red-500/50'
          }`}>
            {/* ✅ IMPROVED: Pulsing animation - more professional */}
            {isListening && (
              <div className="relative flex items-center justify-center">
                <div className="w-3 h-3 bg-white dark:bg-gray-200 rounded-full animate-pulse"></div>
                <div className="absolute w-3 h-3 bg-white dark:bg-gray-200 rounded-full animate-ping"></div>
              </div>
            )}
            
            {/* ✅ IMPROVED: Processing spinner - dark grey for visibility */}
            {isProcessingAudio && (
              <div className="relative flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            {/* ✅ IMPROVED: Clear status text - dark grey for better visibility */}
            <span className={`font-medium text-sm sm:text-base whitespace-nowrap ${
              isProcessingAudio 
                ? 'text-gray-700 dark:text-gray-200' 
                : 'text-white'
            }`}>
              {isProcessingAudio 
                ? 'Processing...' 
                : `Recording • ${formatTime(recordingDuration)}`
              }
            </span>
            
            {/* ✅ IMPROVED: Cancel button - only show when recording (not processing) */}
            {isListening && (
              <button
                onClick={handleCancelRecording}
                className="ml-2 p-1.5 rounded-full hover:bg-white/20 dark:hover:bg-gray-700/50 active:bg-white/30 dark:active:bg-gray-600/50 transition-colors touch-manipulation"
                title="Cancel recording"
                aria-label="Cancel recording"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        </motion.div>
      )}
      
      {/* ✅ CRITICAL FIX: Attachment Preview Tray - Shows selected images and voice notes */}
      {/* ✅ FIX: Hide preview tray during upload/processing to prevent unwanted rectangle */}
      {attachmentPreviews.length > 0 && !isUploading && !isProcessing && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="w-full max-w-4xl mx-auto px-2 sm:px-4 mb-2"
        >
          <div 
            className="flex flex-wrap gap-2 p-2 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-atlas-sand/30 dark:border-gray-700 cursor-text"
            onClick={() => {
              // ✅ UX: Focus caption input when user clicks on attachment area
              setTimeout(() => {
                if (inputRef.current) {
                  inputRef.current.focus();
                }
              }, 100);
            }}
          >
            {attachmentPreviews.map((att) => (
              <motion.div
                key={att.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="relative group"
              >
                {att.type === 'image' && att.previewUrl && (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-atlas-sand">
                    <img
                      src={att.previewUrl}
                      alt={att.name || 'Image preview'}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeAttachment(att.id!)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      aria-label="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {uploadStatus[att.id!] === 'uploading' && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                )}
                {att.type === 'audio' && (
                  <div className="relative w-16 h-16 rounded-lg bg-purple-500/20 border-2 border-purple-300 flex items-center justify-center">
                    <Mic className="w-6 h-6 text-purple-600" />
                    <button
                      onClick={() => removeAttachment(att.id!)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      aria-label="Remove voice note"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {uploadStatus[att.id!] === 'uploading' && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                )}
                {att.type === 'file' && (
                  <div className="relative w-16 h-16 rounded-lg bg-blue-500/20 border-2 border-blue-300 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <button
                      onClick={() => removeAttachment(att.id!)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      aria-label="Remove file"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {uploadStatus[att.id!] === 'uploading' && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
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
          bg-white/70 dark:bg-gray-800/70 backdrop-blur-md shadow-lg mb-0
          sm:bg-gradient-to-r sm:from-atlas-pearl sm:via-atlas-peach sm:to-atlas-pearl
          dark:sm:from-gray-800 dark:sm:via-gray-800 dark:sm:to-gray-800
          sm:backdrop-blur-0 sm:border-2 sm:border-atlas-sand dark:sm:border-gray-700 sm:shadow-lg sm:mb-2
        "
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          gap: '12px', // ✅ FIX: Increased gap to prevent button grouping during upload
          transform: 'translateZ(0)', // ✅ GPU acceleration - prevents blur artifacts
          willChange: 'transform', // ✅ Optimize for animations
          minHeight: '56px', // ✅ FIX: Ensure toolbar never collapses
          display: 'flex', // ✅ FIX: Always flex, never hidden
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
                  
                  // ✅ CRITICAL: Tier check BEFORE validation (bypass prevention)
                  const hasAccess = await attemptImage();
                  if (!hasAccess) {
                    e.target.value = ''; // Clear input
                    showGenericUpgrade('image');
                    return;
                  }
                  
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
                  
                  // ✅ CRITICAL: Tier check before processing (bypass prevention)
                  const hasAccess = await attemptFile();
                  if (!hasAccess) {
                    e.target.value = ''; // Clear input
                    showGenericUpgrade('file');
                    return;
                  }
                  
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
                disabled={!canUseCamera}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  // ✅ CRITICAL: Tier check before processing (bypass prevention)
                  const hasAccess = await attemptCamera();
                  if (!hasAccess) {
                    e.target.value = ''; // Clear input
                    showGenericUpgrade('camera');
                    return;
                  }
                  
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

            {/* Text Input / Caption Input - ✅ PROFESSIONAL: Always visible, clear purpose */}
            <div className="flex-1 flex flex-col min-w-0" style={{ minHeight: '56px' }}>
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
                    ? "Add a caption..."  // Clear, professional placeholder
                    : placeholder
                }
                className={`flex-1 w-full bg-transparent sm:bg-white/95 dark:sm:bg-gray-800/95 text-gray-900 dark:text-white placeholder-atlas-text-muted dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-atlas-sage/40 border border-atlas-sand dark:border-gray-700 rounded-3xl px-4 py-3 resize-none min-h-[56px] max-h-[160px] transition-all duration-200 ease-in-out shadow-sm leading-[1.4] break-words ${
                  attachmentPreviews.length > 0 ? 'text-sm' : ''
                }`}
                style={{ fontSize: '16px', borderRadius: '24px', overflowWrap: 'anywhere', minHeight: '56px', display: 'block' }} // ✅ FIX: Prevent iOS zoom + ensure always visible
                disabled={isProcessing || disabled}
                autoComplete="off"
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck="true"
                rows={1}
              />
            </div>
              {/* Character Counter - Only show when >80% used (professional, non-distracting) */}
              {showCounter && (
                <div className={`text-right text-xs px-3 pb-1 ${
                  percentUsed > 95 ? 'text-red-500' : 'text-amber-500'
                }`}>
                  {maxLength - currentLength} characters remaining
                </div>
              )}

        {/* Action Buttons - ✅ BEST PRACTICE: Fixed sizes, proper spacing, no overflow */}
        {/* ✅ FIX: Prevent button grouping during upload with proper spacing and min-width */}
        <div className="flex items-center gap-3 flex-shrink-0 min-w-fit">
              {/* ✅ PROFESSIONAL MICROPHONE BUTTON: Enhanced UX with clear states */}
              {isVoiceSupported && canUseAudio && (
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
                    : 'bg-atlas-sand hover:bg-atlas-stone text-gray-700 dark:text-gray-300'
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
}, (prevProps, nextProps) => {
  // ✅ PERFORMANCE FIX: Custom comparison - only re-render if critical props change
  // Shallow comparison is safe because props are primitives or stable refs
  return (
    prevProps.isProcessing === nextProps.isProcessing &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.conversationId === nextProps.conversationId &&
    prevProps.onSendMessage === nextProps.onSendMessage &&
    prevProps.placeholder === nextProps.placeholder
  );
});

EnhancedInputToolbar.displayName = 'EnhancedInputToolbar';

export default EnhancedInputToolbar;
