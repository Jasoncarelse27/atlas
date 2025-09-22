import { AnimatePresence, motion } from 'framer-motion';
import { ImageIcon, Mic, Plus, Send, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import UpgradeModal from '../../../components/UpgradeModal';
import { MicButton } from '../../../components/MicButton';
import { ImageButton } from '../../../components/ImageButton';
import { imageService } from '../../../services/imageService';
import VoiceInputWeb from './VoiceInputWeb';

interface ChatInputBarProps {
  onSendMessage: (message: string) => void;
  onVoiceTranscription?: (text: string) => void;
  isProcessing: boolean;
  disabled?: boolean;
  userId?: string;
  tier?: "free" | "core" | "studio";
  sessionId?: string;
  placeholder?: string;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSendMessage,
  onVoiceTranscription,
  isProcessing,
  disabled = false,
  userId,
  tier = "free",
  sessionId,
  placeholder = "Ask anything..."
}) => {
  const [inputValue, setInputValue] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<'voice' | 'image'>('voice');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isPremium = tier === "core" || tier === "studio";

  const handleSubmit = () => {
    if (inputValue.trim() && !isProcessing && !disabled) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  const handleMicClick = () => {
    if (!isPremium) {
      setUpgradeFeature('voice');
      setShowUpgradeModal(true);
      setExpanded(false);
      return;
    }
    setShowVoiceInput(true);
    setExpanded(false);
  };

  const handleVoiceTranscription = (text: string) => {
    // Close the voice input overlay
    setShowVoiceInput(false);
    
    // Send the transcribed text as a message
    if (onVoiceTranscription) {
      onVoiceTranscription(text);
    } else {
      onSendMessage(text);
    }
  };

  // Handle speech-to-text from MicButton
  const handleSpeechToText = (transcript: string) => {
    // Add the transcribed text to the input field
    setInputValue(transcript);
    
    // Focus the input so user can review/edit
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(transcript.length, transcript.length);
    }
  };

  const handleImageClick = () => {
    if (!isPremium) {
      setUpgradeFeature('image');
      setShowUpgradeModal(true);
      setExpanded(false);
      return;
    }
    handleImageUpload();
  };

  const handleImageUpload = () => {
    if (!userId) {
      alert("User not authenticated for image upload.");
      return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = async (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];

      if (!file) {
        return;
      }

      // Validate file size (e.g., max 10MB)
      const MAX_FILE_SIZE_MB = 10;
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        alert("Image file is too large. Please choose a file under 10MB.");
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert("Please select a valid image file.");
        return;
      }

      try {
        setIsUploadingImage(true);
        setExpanded(false);

        console.log(`[ImageUpload] Starting upload for user ${userId}`, {
          fileName: file.name,
          size: file.size,
          type: file.type
        });

        // Upload image to Supabase Storage
        const uploadResult = await imageService.uploadImage(file, userId);
        
        console.log(`[ImageUpload] Upload successful:`, uploadResult);
        
        // Show success feedback
        alert(`Image uploaded successfully!`);
        
        // For now, just show a placeholder message (we'll add Claude Vision analysis later)
        onSendMessage(`Image uploaded: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      } catch (error) {
        console.error("[ImageUpload] Upload failed:", error);
        alert(`Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsUploadingImage(false);
      }
    };

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative p-4 bg-gray-800/50 backdrop-blur-sm border-t border-gray-700">
      <div className="flex items-center space-x-3">
        {/* Mic Button (speech-to-text) */}
        <MicButton onTranscribe={handleSpeechToText} />

        {/* Image Button (file upload) */}
        <ImageButton onImageUpload={(file) => {
          // Handle image upload directly
          if (!userId) {
            alert("User not authenticated for image upload.");
            return;
          }
          
          // Convert file to data URL for now
          const reader = new FileReader();
          reader.onload = (e) => {
            const imageUrl = e.target?.result as string;
            onSendMessage(`Image uploaded: ${file.name}`);
          };
          reader.readAsDataURL(file);
        }} />

        {/* Expandable + button */}
        <div className="relative" ref={menuRef}>
          <motion.button
            onClick={toggleExpanded}
            disabled={disabled}
            className="p-2 rounded-full bg-[#334155] text-white hover:bg-[#475569] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="More options"
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <motion.div
              animate={{ rotate: expanded ? 45 : 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {expanded ? <X size={20} /> : <Plus size={20} />}
            </motion.div>
          </motion.button>

          {/* Floating overlay menu */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                className="absolute bottom-12 left-0 flex gap-3 bg-[#1E293B] rounded-lg shadow-lg p-2 border border-gray-600"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                transition={{ 
                  duration: 0.15, 
                  ease: "easeOut"
                }}
              >
                {/* Legacy Voice button (opens modal) */}
                <motion.button
                  onClick={handleMicClick}
                  disabled={disabled || isProcessing}
                  className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    !isPremium ? 'opacity-50 bg-gray-500' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  title={!isPremium ? "Voice recording (Core/Studio only)" : "Voice recording (modal)"}
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Mic size={18} className="text-white" />
                </motion.button>

                {/* Legacy Image button (opens modal) */}
                <motion.button
                  onClick={handleImageClick}
                  disabled={disabled || isProcessing || isUploadingImage}
                  className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    !isPremium ? 'opacity-50 bg-gray-500' : 'bg-green-600 hover:bg-green-700'
                  }`}
                  title={
                    isUploadingImage 
                      ? "Uploading image..." 
                      : !isPremium 
                        ? "Upload image (Core/Studio only)" 
                        : "Upload image (modal)"
                  }
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  {isUploadingImage ? (
                    <motion.div 
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                  ) : (
                    <ImageIcon size={18} className="text-white" />
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Text input */}
        <motion.input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => {
            setIsInputFocused(true);
            setExpanded(false); // Auto-close menu when typing
          }}
          onBlur={() => setIsInputFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-white px-2 py-2 text-base focus:outline-none"
          disabled={isProcessing || disabled}
          autoComplete="off"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck="true"
          inputMode="text"
          whileFocus={{ scale: 1.01 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        />

        {/* Send button */}
        <motion.button
          onClick={handleSubmit}
          disabled={isProcessing || disabled || !inputValue.trim()}
          className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Send size={18} />
        </motion.button>
      </div>

      {/* Voice Input Overlay */}
      {showVoiceInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1e1e1e] rounded-xl p-6 shadow-2xl border border-gray-600">
            <div className="text-center">
              <h3 className="text-white text-lg font-medium mb-4">Voice Recording</h3>
              <VoiceInputWeb 
                onTranscriptionComplete={handleVoiceTranscription}
                disabled={disabled || isProcessing}
                userId={userId}
                tier={tier}
                sessionId={sessionId}
              />
              <button
                onClick={() => setShowVoiceInput(false)}
                className="mt-4 px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={upgradeFeature}
        userTier={tier}
        onUpgrade={() => {
          // TODO: Integrate with Paddle checkout
          console.log(`User wants to upgrade for ${upgradeFeature} features`);
        }}
        onUpgradeSuccess={() => {
          // Auto-trigger the feature they just unlocked
          if (upgradeFeature === 'voice') {
            // Reopen the + menu and auto-trigger voice recording
            setExpanded(true);
            setTimeout(() => {
              setShowVoiceInput(true);
              setExpanded(false);
            }, 100);
          } else if (upgradeFeature === 'image') {
            // Reopen the + menu and auto-trigger image upload
            setExpanded(true);
            setTimeout(() => {
              handleImageUpload();
              setExpanded(false);
            }, 100);
          }
        }}
      />
    </div>
  );
};

export default ChatInputBar;