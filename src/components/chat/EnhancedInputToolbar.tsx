import { motion } from 'framer-motion';
import { Loader2, Mic, Plus, Send, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useTierAccess } from '../../hooks/useTierAccess';
import { supabase } from '../../lib/supabaseClient';
import { sendMessageWithAttachments, stopMessageStream } from '../../services/chatService';
import { featureService } from '../../services/featureService';
import { useMessageStore } from '../../stores/useMessageStore';
import AttachmentMenu from './AttachmentMenu';

interface EnhancedInputToolbarProps {
  onSendMessage: (message: string) => void;
  isProcessing?: boolean;
  disabled?: boolean;
  placeholder?: string;
  conversationId?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  isVisible?: boolean;
}

export default function EnhancedInputToolbar({
  onSendMessage,
  isProcessing = false,
  disabled = false,
  placeholder = "Ask anything...",
  conversationId,
  inputRef: externalInputRef,
  isVisible = true
}: EnhancedInputToolbarProps) {
  const { user } = useSupabaseAuth();
  const { tier, hasAccess, showUpgradeModal } = useTierAccess();
  const addMessage = useMessageStore((s) => s.addMessage);
  const { isStreaming } = useMessageStore();
  
  // Upgrade modal handler (from useTierAccess hook)
  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachmentPreviews, setAttachmentPreviews] = useState<any[]>([]);
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<string, boolean>>({});
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Use external ref if provided, otherwise use internal ref
  const inputRef = externalInputRef || internalInputRef;

  // ✅ Automatically focus only when input is visible
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 150);
      return () => clearTimeout(timer);
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
    
    // If we have attachments, send them with caption
    if (attachmentPreviews.length > 0 && conversationId) {
      const attachments = attachmentPreviews.map(att => ({
        type: att.type,
        file: att.file,
        previewUrl: att.previewUrl,
        url: att.url || att.publicUrl, // Use uploaded URL
        name: att.name
      }));
      
      try {
        await sendMessageWithAttachments(conversationId, attachments, addMessage, text.trim() || undefined, user?.id);
      } catch (error) {
        console.error("Failed to send attachments:", error);
        toast.error("Failed to send attachments. Please try again.");
      } finally {
        // Always clear input after attempting to send, regardless of success/failure
        setAttachmentPreviews([]);
        setText('');
      }
    } else if (text.trim()) {
      // Regular text message
      onSendMessage(text.trim());
      setText('');
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
      id: attachment.id || crypto.randomUUID() // Ensure it has an ID
    };
    setAttachmentPreviews(prev => [...prev, attachmentWithId]);
    console.log("✅ Attachment added to input area:", attachment.name);
  };

  // Handle removing attachments from input area
  const removeAttachment = (attachmentId: string) => {
    setAttachmentPreviews(prev => prev.filter(att => att.id !== attachmentId));
    console.log("🗑️ Attachment removed from input area");
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
          console.log('[EnhancedInputToolbar] Click outside detected, closing menu');
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
        console.log('[EnhancedInputToolbar] Input blurred, minimizing');
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
    console.log('[EnhancedInputToolbar] Input focused, bouncing up');
    // The bounce animation will be handled by the motion.div
  };

  const handleMicPress = async () => {
    if (!user) {
      toast.error('Please log in to use voice features');
      return;
    }

    const canUse = hasAccess('audio');
    
    // Log the attempt
    await featureService.logAttempt(user.id, 'mic', tier);
    
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
            
            // Upload audio to Supabase Storage
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            
            const uploadResponse = await fetch('/api/upload', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || 'mock-token-for-development'}`
              },
              body: formData
            });
            
            if (!uploadResponse.ok) {
              throw new Error('Upload failed');
            }
            
            const { url } = await uploadResponse.json();
            
            // Transcribe the audio
            const transcribeResponse = await fetch('/api/transcribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || 'mock-token-for-development'}`
              },
              body: JSON.stringify({ audioUrl: url })
            });
            
            if (!transcribeResponse.ok) {
              throw new Error('Transcription failed');
            }
            
            const { transcript } = await transcribeResponse.json();
            
            // Set the transcribed text in the input for user to review and send
            setText(transcript);
            
            toast.success('Voice message transcribed successfully!');
            
          } catch (error) {
            console.error('Voice processing error:', error);
            toast.error('Failed to process voice message. Please try again.');
          } finally {
            setIsListening(false);
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
          }
        };
        
        mediaRecorder.start();
        setIsListening(true);
        toast.success('Recording started... Speak now!');
        
        // Auto-stop after 30 seconds
        setTimeout(() => {
          if (isListening) {
            mediaRecorder.stop();
          }
        }, 30000);
        
      } catch (error) {
        console.error('Microphone access error:', error);
        toast.error('Microphone access denied. Please allow microphone permissions.');
        setIsListening(false);
      }
    } else {
      // Stop recording
      setIsListening(false);
      toast.success('Recording stopped. Processing...');
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
      
      {/* ✅ WhatsApp-style Attachment Previews */}
      {attachmentPreviews.length > 0 && (
        <div className="mb-3 max-w-4xl mx-auto">
          <div className="flex flex-wrap gap-2">
            {attachmentPreviews.map((attachment) => (
              <div key={attachment.id} className="relative">
                    {attachment.type === 'image' && (
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-700">
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
                        
                        {/* ✅ Loading overlay while image is rendering */}
                        {imageLoadingStates[attachment.id] && (
                          <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                        
                        <button
                          onClick={() => removeAttachment(attachment.id)}
                          className="absolute top-1 right-1 w-6 h-6 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-800 shadow-lg"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                {attachment.type === 'file' && (
                  <div className="relative w-20 h-20 rounded-lg bg-gray-700 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl mb-1">📎</div>
                      <div className="text-xs text-gray-300 truncate max-w-16">
                        {attachment.name}
                      </div>
                    </div>
                    <button
                      onClick={() => removeAttachment(attachment.id)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-800 shadow-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {attachment.type === 'audio' && (
                  <div className="relative w-20 h-20 rounded-lg bg-gray-700 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl mb-1">🎤</div>
                      <div className="text-xs text-gray-300">Audio</div>
                    </div>
                    <button
                      onClick={() => removeAttachment(attachment.id)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-800 shadow-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
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
                  console.log('[EnhancedInputToolbar] Plus button clicked, current menuOpen:', menuOpen)
                  
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
                  console.log('[EnhancedInputToolbar] New menuOpen state:', !menuOpen)
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
                console.log('[EnhancedInputToolbar] AttachmentMenu onClose called')
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
              placeholder={attachmentPreviews.length > 0 ? "Add a caption..." : placeholder}
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
                className={`ml-2 rounded-full flex items-center justify-center w-9 h-9 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
                  isStreaming 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
                whileTap={{ scale: 0.9 }}
                title={isStreaming ? "Stop message" : "Send message"}
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
