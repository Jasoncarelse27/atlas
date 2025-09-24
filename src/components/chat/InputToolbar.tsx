import { motion } from 'framer-motion';
import { Mic, Plus, Send } from 'lucide-react';
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { useTierAccess } from '../../hooks/useTierAccess';
import { featureService } from '../../services/featureService';
import AttachmentMenu from './AttachmentMenu';

interface InputToolbarProps {
  onSendMessage: (message: string) => void;
  onVoiceTranscription?: (text: string) => void;
  isProcessing?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export default function InputToolbar({
  onSendMessage,
  onVoiceTranscription,
  isProcessing = false,
  disabled = false,
  placeholder = "Ask anything..."
}: InputToolbarProps) {
  const { user, tier } = useSupabaseAuth();
  const { canUseFeature, showUpgradeModal } = useTierAccess(user?.id);
  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    await featureService.logAttempt(user.id, 'mic', tier);
    
    if (!canUse) {
      showUpgradeModal('audio');
      return;
    }

    // TODO: Implement speech-to-text
    toast.success('Voice recording started (feature coming soon)');
  };


  return (
    <div className="pl-1 pr-3 py-4 sm:pl-2 sm:pr-4 sm:py-4 bg-transparent safe-area-inset-bottom">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* + Button */}
        <motion.button
          ref={buttonRef}
          onClick={() => {
            console.log('🔘 Plus button clicked!');
            setMenuOpen(!menuOpen);
          }}
          disabled={disabled}
          className="p-2 sm:p-2 rounded-full bg-gray-800/50 backdrop-blur-sm hover:bg-gray-700/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          whileTap={{ scale: 0.95 }}
          title="Add attachment"
        >
          <Plus size={20} className="text-gray-300" />
        </motion.button>

        {/* Text Input */}
        <motion.input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="flex-1 bg-gray-800/50 backdrop-blur-sm rounded-full px-3 py-2 sm:px-4 sm:py-3 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-gray-700/70 transition-colors text-base"
          disabled={isProcessing || disabled}
          autoComplete="off"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck="true"
          whileFocus={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        />

        {/* Mic Button */}
        <motion.button
          onClick={() => {
            if (!canUseFeature('audio')) {
              toast.error('Voice features are available in Core & Studio plans. Upgrade to unlock!');
              showUpgradeModal();
              return;
            }
            handleMicPress();
          }}
          disabled={isProcessing || disabled}
          className="p-2 sm:p-2 rounded-full bg-gray-800/50 backdrop-blur-sm hover:bg-gray-700/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          whileTap={{ scale: 0.95 }}
          title="Voice recording"
        >
          <Mic size={20} className="text-gray-300" />
        </motion.button>

        {/* Send Button */}
        <motion.button
          onClick={handleSend}
          disabled={isProcessing || disabled || !text.trim()}
          className="p-2 rounded-full bg-blue-600/80 backdrop-blur-sm hover:bg-blue-700/90 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-600/50"
          whileTap={{ scale: 0.95 }}
          title="Send message"
        >
          <Send size={20} />
        </motion.button>
      </div>

      {/* Attachment Menu */}
      {menuOpen && (
        <AttachmentMenu
          anchorRef={buttonRef}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
