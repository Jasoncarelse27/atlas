import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Image, Loader2, MessageSquare, Mic, Phone, Plus, Send, Square, X, XCircle } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { modernToast } from '../../config/toastConfig';
import { useUpgradeModals } from '../../contexts/UpgradeModalContext';
import type { Message } from '../../database/types';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useFeatureAccess, useTierAccess } from '../../hooks/useTierAccess';
import { sendMessageWithAttachments, stopMessageStream } from '../../services/chatService';
import '../../styles/voice-animations.css';
// Removed useMessageStore import - using props from parent component
import { logger } from '../../lib/logger';
import { voiceService } from '../../services/voiceService';
import { generateUUID } from '../../utils/uuid';
import { VoiceCallModal } from '../modals/VoiceCallModal';
import AttachmentMenu from './AttachmentMenu';
import { isVoiceCallComingSoon } from '../../config/featureAccess';

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
  const { canUse: canUseVoice } = useFeatureAccess('voice');
  const { canUse: canUseImage } = useFeatureAccess('image');
  const { canUse: canUseAudio, attemptFeature: attemptAudio } = useFeatureAccess('audio'); // ✅ Add audio feature access
  const { showGenericUpgrade } = useUpgradeModals();
  
  // ✅ Studio-only feature check (voice calls)
  const isStudioTier = tier === 'studio';
  
  // Upgrade modal handler (from useTierAccess hook)
  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [attachmentPreviews, setAttachmentPreviews] = useState<any[]>([]);
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [isStartingVoiceCall, setIsStartingVoiceCall] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'uploading' | 'processing' | 'success' | 'error'>>({});
  const [isUploading, setIsUploading] = useState(false);
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use external ref if provided, otherwise use internal ref
  const inputRef = externalInputRef || internalInputRef;

  // ✅ Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
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

  const handleSend = async () => {
    if (isProcessing || disabled) return;
    
    // ✅ IMMEDIATE UI CLEAR - Clear attachments and text instantly for better UX
    const currentText = text.trim();
    const currentAttachments = [...attachmentPreviews];
    
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
            setUploadStatus(prev => ({ ...prev, [att.id]: 'analyzing' }));
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
            setUploadStatus(prev => ({ ...prev, [att.id]: 'success' }));
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
            setUploadStatus(prev => ({ ...prev, [att.id]: 'error' }));
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

  const handleMicPress = async () => {
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

    if (!isListening) {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        modernToast.error('Microphone Blocked', 'Allow microphone access in browser settings');
        setIsListening(false);
      }
    } else {
      // Stop recording
      const mediaRecorder = (window as any).__atlasMediaRecorder;
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
        mediaRecorder.stop();
        modernToast.info('Processing Audio', 'Converting to text...');
      }
      setIsListening(false);
      setRecordingDuration(0);
    }
  };

  const handleStartVoiceCall = async () => {
    if (!user) {
      modernToast.error('Login Required', 'Sign in to start voice calls');
      return;
    }

    // ✅ SOFT LAUNCH: Check if voice calls are coming soon
    if (isVoiceCallComingSoon()) {
      modernToast.info('🎙️ Voice Calls Coming Soon', 'This feature will be available soon!', {
        duration: 4000,
        icon: '🔜',
      });
      return;
    }

    if (!canUseVoice) {
      // ✅ Show upgrade modal with voice_calls feature (triggers Studio tier)
      showGenericUpgrade('voice_calls');
      return;
    }
    
    // Mark voice call as used (remove NEW badge)
    localStorage.setItem('hasUsedVoiceCall', 'true');
    
    // Show loading state
    setIsStartingVoiceCall(true);
    
    // Small delay to show loading state, then open modal
    setTimeout(() => {
      setIsStartingVoiceCall(false);
    setShowVoiceCall(true);
    }, 300);
  };


  // Click outside detection is handled by AttachmentMenu component

  return (
    <div className="px-2 sm:px-4 pb-0" style={{ backgroundColor: '#F9F6F3' }}> {/* ✅ FIX: Atlas pearl background - removes black block */}
      {/* Message Limit Warning - Temporarily disabled */}
      {/* {false && (
        <div className="mb-3 p-3 bg-red-900/30 border border-red-700/50 rounded-lg max-w-4xl mx-auto">
          <p className="text-red-200 text-sm text-center">
            ⚠️ Daily conversation limit reached. 
            <button 
              onClick={() => onShowUpgradeModal?.()}
              className="ml-1 text-red-300 hover:text-red-100 underline"
            >
              Upgrade to continue
            </button>
          </p>
        </div>
      )} */}
      
      {/* ✅ Modernized Attachment Previews */}
      {attachmentPreviews.length > 0 && (
        <div className="mb-3 max-w-4xl mx-auto">
          {/* Subtle Hint */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-400">Add an optional caption below</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {attachmentPreviews.map((attachment) => {
              const status = uploadStatus[attachment.id] || 'uploading';
              return (
                <motion.div 
                  key={attachment.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center justify-between rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-2 mt-2 transition-all max-w-[90vw]"
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
      
      {/* ✅ Single Loading Indicator - Only show during AI analysis, not during upload */}
      {isUploading && attachmentPreviews.length === 0 && (
        <div className="absolute bottom-14 left-0 right-0 flex justify-center z-50">
          <div className="flex items-center space-x-2 bg-neutral-900/90 rounded-full px-4 py-2 shadow-xl border border-white/20 backdrop-blur-sm">
            <Loader2 className="w-4 h-4 animate-spin text-white/90" />
            <span className="text-sm text-white/90 font-medium">Analyzing image...</span>
          </div>
        </div>
      )}
      
      {/* 🎙️ Recording Indicator - ChatGPT Style */}
      {isListening && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-14 left-0 right-0 flex justify-center z-50"
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
      
          {/* Main Input Container - Floating white card, no borders */}
          {/* ✅ MOBILE BEST PRACTICE: items-center for proper vertical alignment on iOS/Android */}
          <motion.div 
            data-input-area
            className="flex items-center w-full max-w-4xl mx-auto px-3 py-2 rounded-2xl mb-6"
            style={{
              background: '#ffffff !important',
              backgroundColor: '#ffffff !important',
              backdropFilter: 'none !important',
              WebkitBackdropFilter: 'none !important',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
            }}
          >
        
        {/* + Attachment Button */}
        <div className="relative">
              <motion.button
                ref={buttonRef}
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
                className={`min-h-[44px] min-w-[44px] p-2 rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl touch-manipulation flex items-center justify-center ${
                  menuOpen 
                    ? 'bg-[#D3DCAB] text-gray-800' 
                    : 'bg-[#F3D3B8] hover:bg-[#D3DCAB] text-gray-800'
                }`}
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: menuOpen 
                    ? '0 4px 16px rgba(211, 220, 171, 0.4), inset 0 -2px 4px rgba(151, 134, 113, 0.15)'
                    : '0 4px 16px rgba(243, 211, 184, 0.4), inset 0 -2px 4px rgba(151, 134, 113, 0.15)'
                }}
                title="Add attachment"
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
              conversationId={conversationId || ""}
              userId={user?.id || ""}
              onAddAttachment={handleAddAttachment}
            />
          )}
        </div>

            {/* Text Input - Dual purpose: text or caption */}
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
                  ? (window.innerWidth < 640 ? "Add a caption..." : "Add a caption (optional)...")
                  : placeholder
              }
              className="flex-1 mx-2 sm:mx-3 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 border-none rounded-2xl px-4 py-3 resize-none min-h-[44px] max-h-[120px] transition-all duration-200 ease-in-out"
              style={{ fontSize: '16px', borderRadius: '16px' }} // Prevent iOS zoom + extra rounded
              disabled={isProcessing || disabled}
              autoComplete="off"
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck="true"
              rows={1}
            />

        {/* Action Buttons - ✅ MOBILE BEST PRACTICE: Vertically centered for iOS/Android */}
        <div className="flex items-center space-x-2">
              {/* Mic Button */}
              <motion.button
                onClick={handleMicPress}
                disabled={isProcessing || disabled}
                className={`min-h-[44px] min-w-[44px] p-2 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md touch-manipulation flex items-center justify-center ${
                  isListening
                    ? 'bg-red-500/80 hover:bg-red-600/90 text-white'
                    : 'bg-[#CEC1B8] hover:bg-[#978671] text-gray-700'
                }`}
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: isListening 
                    ? undefined 
                    : '0 2px 8px rgba(151, 134, 113, 0.3), inset 0 -1px 2px rgba(151, 134, 113, 0.2)'
                }}
                title="Voice recording"
              >
                <Mic size={18} />
              </motion.button>

              {/* Voice Call Button - Coming Soon (Soft Launch) */}
              <motion.button
                onClick={() => {
                  // ✅ SOFT LAUNCH: Show "coming soon" message
                  if (isVoiceCallComingSoon()) {
                    modernToast.info('🎙️ Voice Calls Coming Soon', 'This feature will be available soon!', {
                      duration: 4000,
                      icon: '🔜',
                    });
                    return;
                  }
                  // ✅ Add haptic feedback
                  if ('vibrate' in navigator) navigator.vibrate(20);
                  handleStartVoiceCall();
                }}
                disabled={disabled || isStartingVoiceCall || isVoiceCallComingSoon()}
                title={
                  isVoiceCallComingSoon()
                    ? "Voice calls coming soon!"
                    : isStudioTier 
                      ? "Start voice call (Studio)" 
                      : "Voice calls available in Studio tier - Upgrade now"
                }
                className={`relative ml-2 rounded-full flex items-center justify-center min-h-[44px] min-w-[44px] w-9 h-9 transition-all duration-200 shadow-lg touch-manipulation ${
                  isVoiceCallComingSoon()
                    ? 'bg-[#8FA67E]/50 hover:bg-[#8FA67E]/50 opacity-70 cursor-not-allowed'
                    : isStudioTier
                      ? 'bg-[#8FA67E] hover:bg-[#7E9570] text-white voice-call-pulse animate-pulse-subtle'
                      : 'bg-gray-600 hover:bg-gray-500 opacity-60'
                } ${isStartingVoiceCall ? 'opacity-50 cursor-wait' : ''}`}
                style={{ 
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: isVoiceCallComingSoon()
                    ? undefined
                    : isStudioTier 
                      ? '0 4px 12px rgba(143, 166, 126, 0.4), inset 0 -2px 4px rgba(126, 149, 112, 0.15)'
                      : undefined
                }}
              >
                {isStartingVoiceCall ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  />
                ) : (
                  <>
                    <Phone className="w-4 h-4 text-white" />
                    {isVoiceCallComingSoon() && isStudioTier && (
                      <span className="absolute -top-1 -right-1 px-1 py-0.5 text-[8px] font-medium bg-[#8FA67E]/20 text-[#8FA67E] rounded-full border border-[#8FA67E]/30">
                        Soon
                      </span>
                    )}
                  </>
                )}
                {!isVoiceCallComingSoon() && isStudioTier && !localStorage.getItem('hasUsedVoiceCall') && !isStartingVoiceCall && (
                  <span className="voice-call-badge">New</span>
                )}
              </motion.button>

              {/* Dynamic Button: Send/Stop (has text or attachments) */}
              {text.trim() || attachmentPreviews.length > 0 ? (
                // Send/Stop button with progressive animation
                <motion.button
                  onClick={() => {
                    // Haptic feedback
                    if ('vibrate' in navigator) {
                      navigator.vibrate(isStreaming ? 40 : 20);
                    }
                    isStreaming ? stopMessageStream() : handleSend();
                  }}
                  disabled={disabled || (!isStreaming && !text.trim() && attachmentPreviews.length === 0)}
                  title={isStreaming ? "Stop Generation" : (attachmentPreviews.length > 0 ? `Send ${attachmentPreviews.length} attachment${attachmentPreviews.length > 1 ? 's' : ''}` : "Send message")}
                  whileTap={{ scale: 0.95 }}
                  className={`ml-2 rounded-full flex items-center justify-center min-h-[44px] min-w-[44px] w-9 h-9 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg touch-manipulation ${
                    isStreaming 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-[#D3DCAB] hover:bg-[#978671] text-gray-800'
                  }`}
                  style={{ 
                    WebkitTapHighlightColor: 'transparent',
                    boxShadow: isStreaming 
                      ? '0 4px 16px rgba(239, 68, 68, 0.5)' 
                      : '0 4px 12px rgba(211, 220, 171, 0.4), inset 0 -2px 4px rgba(151, 134, 113, 0.15)'
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
                        <Send className="w-4 h-4 text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              ) : null}
        </div>
      </motion.div>

      {/* Voice Call Modal */}
      {user && conversationId && (
        <VoiceCallModal
          isOpen={showVoiceCall}
          onClose={() => setShowVoiceCall(false)}
          userId={user.id}
          conversationId={conversationId}
        />
      )}
    </div>
  );
}
