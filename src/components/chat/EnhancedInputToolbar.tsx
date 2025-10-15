import { motion } from 'framer-motion';
import { CheckCircle2, Image, Loader2, Mic, Plus, Send, X, XCircle } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useTierAccess } from '../../hooks/useTierAccess';
import { sendMessageWithAttachments, stopMessageStream } from '../../services/chatService';
import { featureService } from '../../services/featureService';
// Removed useMessageStore import - using props from parent component
import { voiceService } from '../../services/voiceService';
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
  addMessage?: (message: any) => void;
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
  const { tier, showUpgradeModal } = useTierAccess();
  
  // Upgrade modal handler (from useTierAccess hook)
  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachmentPreviews, setAttachmentPreviews] = useState<any[]>([]);
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<string, boolean>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'uploading' | 'processing' | 'success' | 'error'>>({});
  const [isUploading, setIsUploading] = useState(false);
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Use external ref if provided, otherwise use internal ref
  const inputRef = externalInputRef || internalInputRef;

  // ✅ Auto-focus immediately when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current && isVisible) {
        inputRef.current.focus();
        console.log('[EnhancedInputToolbar] ✅ Input focused on mount');
      }
    }, 100); // Shorter delay for immediate focus
    return () => clearTimeout(timer);
  }, []); // Run once on mount

  // ✅ Re-focus when visibility changes
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
      console.log('[EnhancedInputToolbar] ✅ Input focused on visibility change');
    }
  }, [isVisible]);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isStreaming) {
        stopMessageStream();
        toast.success("Message cancelled");
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
    
    // Clear UI immediately for instant feedback
    setAttachmentPreviews([]);
    setText('');
    
    // Show immediate feedback
    if (onSoundPlay) {
      onSoundPlay('send_message');
    }
    
    // 🎯 FUTURE-PROOF FIX: Send attachments even without conversationId (backend will create one)
    if (currentAttachments.length > 0) {
      const attachments = currentAttachments.map(att => ({
        type: att.type,
        file: att.file,
        previewUrl: att.previewUrl,
        url: att.url || att.publicUrl, // Use uploaded URL
        name: att.name
      }));
      
      try {
        // Update status to analyzing (more specific feedback)
        attachments.forEach((att: any) => {
          if (att.id) {
            setUploadStatus(prev => ({ ...prev, [att.id]: 'analyzing' }));
          }
        });

        // Show analyzing toast
        toast.success('🧠 Analyzing image...');
        
        // Set processing state for floating indicator
        setIsUploading(true);
        
        // Use Promise.race for timeout protection (increased timeout for image analysis)
        if (addMessage) {
          await Promise.race([
            sendMessageWithAttachments(conversationId || '', attachments, addMessage, currentText || undefined, user?.id),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Send timeout')), 15000) // Reduced from 30000ms for better mobile UX
            )
          ]);
        }
        
        // Update status to success
        attachments.forEach((att: any) => {
          if (att.id) {
            setUploadStatus(prev => ({ ...prev, [att.id]: 'success' }));
          }
        });
        
        // Show success toast
        toast.success("✅ Image analyzed successfully!");
        
        // Clear upload status after success
        setTimeout(() => {
          setIsUploading(false);
          setUploadStatus({});
        }, 1500);
      } catch (error) {
        
        // Update status to error
        attachments.forEach((att: any) => {
          if (att.id) {
            setUploadStatus(prev => ({ ...prev, [att.id]: 'error' }));
          }
        });
        
        // More specific error messages
        if (error instanceof Error && error.message === 'Send timeout') {
          toast.error("Image analysis is taking longer than expected. Please try again.");
        } else {
          toast.error("Failed to send attachments. Please try again.");
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
  const handleAddAttachment = (attachment: any) => {
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

  const handleMicPress = async () => {
    if (!user) {
      toast.error('Please log in to use voice features');
      return;
    }

    // 🎯 FUTURE-PROOF FIX: Check tier directly instead of waiting for hasAccess
    
    // Log the attempt
    await featureService.logAttempt(user.id, 'audio', tier);
    
    // Core and Studio tiers have audio access
    const canUse = tier === 'core' || tier === 'studio';
    
    if (!canUse) {
      toast.error('Voice features are available in Core & Studio plans. Upgrade to unlock!');
      showUpgradeModal('audio');
      return;
    }
    

    if (!isListening) {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks: Blob[] = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = async () => {
          try {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
            // 🎯 FUTURE-PROOF FIX: Use voiceService for transcription
            const transcript = await voiceService.recordAndTranscribe(audioBlob, tier as 'free' | 'core' | 'studio');
            
            // Set the transcribed text in the input for user to review and send
            setText(transcript);
            
            toast.success('✅ Voice transcribed! Review and send.');
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to process voice message';
            
            // Show upgrade prompt if tier restriction error
            if (errorMessage.includes('requires Core or Studio')) {
              showUpgradeModal('audio');
            } else {
              toast.error(errorMessage);
            }
          } finally {
            setIsListening(false);
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
          }
        };
        
        mediaRecorder.start();
        setIsListening(true);
        toast.success('🎙️ Recording... Speak now!');
        
        // Auto-stop after 30 seconds
        setTimeout(() => {
          if (isListening && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, 30000);
        
      } catch (error) {
        toast.error('Microphone access denied. Please allow microphone permissions.');
        setIsListening(false);
      }
    } else {
      // Stop recording
      setIsListening(false);
      toast.success('🛑 Recording stopped. Processing...');
    }
  };


  // Click outside detection is handled by AttachmentMenu component

  return (
    <div className="px-2 sm:px-4 pb-0 bg-transparent">
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
                          onLoad={() => {
                            setImageLoadingStates(prev => ({ ...prev, [attachment.id]: false }));
                          }}
                          onError={(e) => {
                            setImageLoadingStates(prev => ({ ...prev, [attachment.id]: false }));
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        {imageLoadingStates[attachment.id] && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                            <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                          </div>
                        )}
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
                        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                        <span className="text-xs text-blue-400">Processing...</span>
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
      
          {/* Main Input Container - Professional Style with Bounce Animation */}
          <motion.div 
            data-input-area
            className="flex items-center w-full max-w-4xl mx-auto px-3 py-2 sm:px-4 sm:py-3 bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-700/50"
            initial={{ y: 0, scale: 1 }}
            animate={{ y: 0, scale: 1 }}
            whileFocus={{ 
              y: -2, 
              scale: 1.02,
              transition: { 
                type: "spring", 
                stiffness: 300, 
                damping: 20,
                duration: 0.3 
              }
            }}
            whileTap={{ 
              scale: 0.98,
              transition: { 
                type: "spring", 
                stiffness: 400, 
                damping: 25 
              }
            }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 30 
            }}
          >
        
        {/* + Attachment Button */}
        <div className="relative">
              <motion.button
                ref={buttonRef}
                onClick={() => {
                  
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
                className={`p-2 rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md ${
                  menuOpen 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 hover:text-white'
                }`}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
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
              ref={inputRef}
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
              placeholder={attachmentPreviews.length > 0 ? "💡 Add a caption and press Enter to send..." : placeholder}
              className="flex-1 mx-2 sm:mx-3 bg-transparent text-white placeholder-gray-400 focus:outline-none text-base border-none rounded-lg px-2 py-1 sm:px-3 sm:py-2 resize-none min-h-[36px] sm:min-h-[40px] max-h-[120px] transition-all duration-200 ease-in-out"
              disabled={isProcessing || disabled}
              autoComplete="off"
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck="true"
              rows={1}
            />

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
              {/* Mic Button */}
              <motion.button
                onClick={handleMicPress}
                disabled={isProcessing || disabled}
                className={`p-2 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
                  isListening
                    ? 'bg-red-500/80 hover:bg-red-600/90 text-white'
                    : 'bg-gray-700/60 hover:bg-gray-600/80 text-gray-300'
                }`}
                whileTap={{ scale: 0.95 }}
                title="Voice recording"
              >
                <Mic size={18} />
              </motion.button>

              {/* Dynamic Send/Stop Button */}
              <motion.button
                onClick={isStreaming ? stopMessageStream : handleSend}
                disabled={disabled || (!isStreaming && !text.trim() && attachmentPreviews.length === 0)}
                title={attachmentPreviews.length > 0 ? `Send ${attachmentPreviews.length} attachment${attachmentPreviews.length > 1 ? 's' : ''} with caption` : (isStreaming ? "Stop message" : "Send message")}
                className={`ml-2 rounded-full flex items-center justify-center w-9 h-9 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
                  isStreaming 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
                whileTap={{ scale: 0.9 }}
              >
                {isStreaming ? (
                  <motion.div
                    className="w-3 h-3 bg-white rounded-sm"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.6, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                  />
                ) : isProcessing ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-white" />
                )}
              </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
