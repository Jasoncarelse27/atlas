import { motion } from 'framer-motion';
import { Mic, Plus, Send } from 'lucide-react';
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useTierAccess } from '../../hooks/useTierAccess';
import { featureService } from '../../services/featureService';
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
}

export default function EnhancedInputToolbar({
  onSendMessage,
  onVoiceTranscription,
  onFileMessage,
  onImageUpload,
  isProcessing = false,
  disabled = false,
  placeholder = "Ask anything...",
  onShowUpgradeModal
}: EnhancedInputToolbarProps) {
  const { user } = useSupabaseAuth();
  const { tier, canUseFeature, showUpgradeModal } = useTierAccess();
  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleSend = () => {
    if (!text.trim() || isProcessing || disabled) return;
    
    // Message limit checking removed for now - focus on tier logic
    
    onSendMessage(text.trim());
    setText('');
    
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

  const handleMicPress = async () => {
    if (!user) {
      toast.error('Please log in to use voice features');
      return;
    }

    const canUse = canUseFeature('audio');
    
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

    const canUse = canUseFeature(feature);
    
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
      {false && (
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
      )}
      
      {/* Main Input Container - iOS Style */}
      <div className="flex items-center w-full max-w-4xl mx-auto px-4 py-3 bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-700/50">
        
        {/* + Attachment Button */}
        <div className="relative">
          <motion.button
            ref={buttonRef}
            onClick={() => setMenuOpen(!menuOpen)}
            disabled={disabled}
            className="p-2 rounded-full bg-gray-700/50 hover:bg-gray-600/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            whileTap={{ scale: 0.95 }}
            title="Add attachment"
          >
            <Plus size={20} className="text-gray-300" />
          </motion.button>

          {/* Attachment Menu */}
          {menuOpen && (
            <AttachmentMenu
              onClose={() => setMenuOpen(false)}
              onImageUpload={onImageUpload}
              onSelect={(files) => {
                // Handle multiple files
                files.forEach(file => {
                  if (file.type.startsWith('image/') && onImageUpload) {
                    onImageUpload(file);
                  }
                });
                setMenuOpen(false);
              }}
            />
          )}
        </div>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="flex-1 mx-3 bg-transparent text-gray-100 placeholder-gray-400 focus:outline-none text-base"
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
            className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isListening 
                ? 'bg-red-500/80 hover:bg-red-600/90 text-white' 
                : 'bg-gray-700/50 hover:bg-gray-600/70 text-gray-300'
            }`}
            whileTap={{ scale: 0.95 }}
            title="Voice recording"
          >
            <Mic size={20} />
          </motion.button>

          {/* Send Button */}
          <motion.button
            onClick={handleSend}
            disabled={isProcessing || disabled || !text.trim()}
            className="p-2 rounded-full bg-blue-600/80 hover:bg-blue-700/90 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-600/50"
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
