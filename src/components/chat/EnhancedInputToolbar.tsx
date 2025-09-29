import { motion } from 'framer-motion';
import { Mic, Plus, Send, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { canUseFeature, useSimpleTier } from '../../hooks/useSimpleTier';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { sendMessageWithAttachments } from '../../services/chatService';
import { featureService } from '../../services/featureService';
import { useMessageStore } from '../../stores/useMessageStore';
import type { Message } from '../../types/chat';
import AttachmentMenu from './AttachmentMenu';

interface EnhancedInputToolbarProps {
  onSendMessage: (message: string) => void;
  onVoiceTranscription?: (text: string) => void;
  onFileMessage?: (message: Message) => void;
  onImageUpload?: (file: File) => void;
  isProcessing?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onShowUpgradeModal?: () => void;
  conversationId?: string;
}

export default function EnhancedInputToolbar({
  onSendMessage,
  onVoiceTranscription,
  onFileMessage,
  onImageUpload,
  isProcessing = false,
  disabled = false,
  placeholder = "Ask anything...",
  onShowUpgradeModal,
  conversationId
}: EnhancedInputToolbarProps) {
  const { user } = useSupabaseAuth();
  const { tier, loading: tierLoading, error: tierError } = useSimpleTier(user?.id);
  const addMessage = useMessageStore((s) => s.addMessage);
  
  // Simple upgrade modal handler
  const showUpgradeModal = (feature: string) => {
    console.log(`⚠️ Upgrade required for: ${feature}`);
    // For now, just show a toast - we can add modal later
    toast.error(`${feature} features require Core or Studio plan. Upgrade to unlock!`);
  };
  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachmentPreviews, setAttachmentPreviews] = useState<any[]>([]);
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleSend = async () => {
    if (isProcessing || disabled) return;
    
    console.log("🚀 handleSend called:", { 
      attachmentPreviews: attachmentPreviews.length, 
      text: text.trim(), 
      conversationId 
    });
    
    // If we have attachments, send them with caption
    if (attachmentPreviews.length > 0 && conversationId) {
      console.log("📎 Sending attachments with caption:", text.trim());
      
      const attachments = attachmentPreviews.map(att => ({
        type: att.type,
        file: att.file,
        previewUrl: att.previewUrl,
        name: att.name
      }));
      
      try {
        await sendMessageWithAttachments(conversationId, attachments, addMessage, text.trim() || undefined);
        console.log("✅ Attachments sent successfully");
        setAttachmentPreviews([]);
        setText('');
      } catch (error) {
        console.error("❌ Failed to send attachments:", error);
        toast.error("Failed to send attachments. Please try again.");
      }
    } else if (text.trim()) {
      // Regular text message
      console.log("💬 Sending text message:", text.trim());
      onSendMessage(text.trim());
      setText('');
    }
    
    // Focus input for next message
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (files: FileList, type: string) => {
    if (!files?.length) return;

    const newAttachments = Array.from(files).map((file) => {
      const tempUrl = URL.createObjectURL(file);
      const id = crypto.randomUUID();
      return { 
        id,
        type, 
        file, 
        previewUrl: tempUrl, 
        name: file.name 
      };
    });

    // ✅ Set loading state for images
    const loadingStates: Record<string, boolean> = {};
    newAttachments.forEach(att => {
      if (att.type === 'image') {
        loadingStates[att.id] = true;
      }
    });
    setImageLoadingStates(prev => ({ ...prev, ...loadingStates }));

    setAttachmentPreviews(prev => [...prev, ...newAttachments]);
    setMenuOpen(false); // ✅ Close menu after file selection
  };

  // ✅ Handle clicking outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuOpen && !buttonRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const removeAttachment = (id: string) => {
    setAttachmentPreviews(prev => prev.filter(att => att.id !== id));
  };

  const handleMicPress = async () => {
    if (!user) {
      toast.error('Please log in to use voice features');
      return;
    }

    const canUse = canUseFeature(tier, 'audio');
    
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
                'Authorization': `Bearer ${user.access_token || 'mock-token-for-development'}`
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
                'Authorization': `Bearer ${user.access_token || 'mock-token-for-development'}`
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

  const handleFeatureClick = async (feature: 'image' | 'camera' | 'audio') => {
    if (!user) {
      toast.error('Please log in to use this feature');
      return;
    }

    const canUse = canUseFeature(tier, feature);
    
    // Log the attempt
    await featureService.logAttempt(user.id, feature, canUse, !canUse);
    
    if (!canUse) {
      toast.error(`${feature} features are available in Core & Studio plans. Upgrade to unlock!`);
      showUpgradeModal(feature);
      return;
    }

    // Feature-specific logic
    switch (feature) {
      case 'image':
        toast.success('Image picker opened (feature coming soon)');
        break;
      case 'camera':
        toast.success('Camera access requested (feature coming soon)');
        break;
      case 'audio':
        handleMicPress();
        break;
    }

    setMenuOpen(false);
  };

  // Click outside detection is handled by AttachmentMenu component

  return (
    <div className="px-4 pb-4 bg-transparent">
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
                          src={attachment.previewUrl}
                          alt={attachment.name}
                          className="w-full h-full object-cover"
                          onLoad={() => {
                            // ✅ Image loaded successfully - hide loader
                            console.log(`[AttachmentPreview] Image loaded: ${attachment.name}`);
                            setImageLoadingStates(prev => ({ ...prev, [attachment.id]: false }));
                          }}
                          onError={(e) => {
                            console.warn(`[AttachmentPreview] Failed to load image: ${attachment.name}`, e);
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
      
          {/* Main Input Container - Professional Style */}
          <div className="flex items-center w-full max-w-4xl mx-auto px-4 py-3 bg-gray-800/90 backdrop-blur-sm rounded-3xl shadow-xl border border-gray-600/30">
        
        {/* + Attachment Button */}
        <div className="relative">
              <motion.button
                ref={buttonRef}
                onClick={() => setMenuOpen(!menuOpen)}
                disabled={disabled}
                className="p-2 rounded-xl bg-gray-700/60 hover:bg-gray-600/80 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                whileTap={{ scale: 0.95 }}
                title="Add attachment"
              >
                <Plus size={20} className="text-gray-300" />
              </motion.button>

          {/* Attachment Menu */}
          {menuOpen && (
            <AttachmentMenu
              conversationId={conversationId || ""}
              onClose={() => setMenuOpen(false)}
              onFileSelect={handleFileSelect}
            />
          )}
        </div>

            {/* Text Input - Dual purpose: text or caption */}
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={attachmentPreviews.length > 0 ? "Add a caption..." : placeholder}
              className="flex-1 mx-3 bg-transparent text-gray-100 placeholder-gray-400 focus:outline-none text-base border-none rounded-xl px-3 py-2"
              disabled={isProcessing || disabled}
              autoComplete="off"
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck="true"
            />

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
              {/* Mic Button */}
              <motion.button
                onClick={handleMicPress}
                disabled={isProcessing || disabled}
                className={`p-2 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
                  isListening
                    ? 'bg-red-500/80 hover:bg-red-600/90 text-white'
                    : 'bg-gray-700/60 hover:bg-gray-600/80 text-gray-300'
                }`}
                whileTap={{ scale: 0.95 }}
                title="Voice recording"
              >
                <Mic size={20} />
              </motion.button>

              {/* Send Button */}
              <motion.button
                onClick={handleSend}
                disabled={isProcessing || disabled || (!text.trim() && attachmentPreviews.length === 0)}
                className="p-2 rounded-xl bg-blue-600/80 hover:bg-blue-700/90 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-600/50 shadow-sm"
                whileTap={{ scale: 0.95 }}
                title="Send message"
              >
                <Send size={20} />
              </motion.button>
        </div>
      </div>
    </div>
  );
}
