import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Image, Mic, Plus, Send } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useTierAccess } from '../../hooks/useTierAccess';
import { featureService } from '../../services/featureService';

interface EnhancedInputToolbarProps {
  onSendMessage: (message: string) => void;
  onVoiceTranscription?: (text: string) => void;
  isProcessing?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export default function EnhancedInputToolbar({
  onSendMessage,
  onVoiceTranscription,
  isProcessing = false,
  disabled = false,
  placeholder = "Ask anything..."
}: EnhancedInputToolbarProps) {
  const { user } = useSupabaseAuth();
  const { canUseFeature, showUpgradeModal } = useTierAccess();
  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (!text.trim() || isProcessing || disabled) return;
    
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
    await featureService.logAttempt(user.id, 'mic', canUse, !canUse);
    
    if (!canUse) {
      toast.error('Voice features are available in Core & Studio plans. Upgrade to unlock!');
      showUpgradeModal('audio');
      return;
    }

    // TODO: Implement speech-to-text
    setIsListening(!isListening);
    toast.success(isListening ? 'Voice recording stopped' : 'Voice recording started');
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

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <div className="px-4 pb-4 bg-transparent">
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
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-0 mb-2 bg-gray-900 rounded-lg shadow-lg border border-gray-700 p-2 flex flex-col min-w-[200px] z-50"
              >
                <button
                  onClick={() => handleFeatureClick('image')}
                  className="p-3 text-white hover:bg-gray-700 rounded-lg transition-colors flex items-center space-x-3"
                >
                  <Image size={18} className="text-blue-400" />
                  <span>Add Photo</span>
                </button>
                
                <button
                  onClick={() => handleFeatureClick('camera')}
                  className="p-3 text-white hover:bg-gray-700 rounded-lg transition-colors flex items-center space-x-3"
                >
                  <Camera size={18} className="text-green-400" />
                  <span>Take Photo</span>
                </button>
                
                <button
                  onClick={() => handleFeatureClick('audio')}
                  className="p-3 text-white hover:bg-gray-700 rounded-lg transition-colors flex items-center space-x-3"
                >
                  <Mic size={18} className="text-purple-400" />
                  <span>Record Audio</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
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
