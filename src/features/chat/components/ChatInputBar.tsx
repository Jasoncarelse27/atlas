import { ImageIcon, Mic, Plus, Send } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
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
  const menuRef = useRef<HTMLDivElement>(null);
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
      alert("Voice recording is available for Core and Studio subscribers. Upgrade to unlock this feature!");
      setExpanded(false);
      return;
    }
    setShowVoiceInput(true);
    setExpanded(false);
  };

  const handleVoiceTranscription = (text: string) => {
    setShowVoiceInput(false);
    onSendMessage(text);
  };

  const handleImageClick = () => {
    if (!isPremium) {
      alert("Image upload is available for Core and Studio subscribers. Upgrade to unlock this feature!");
      setExpanded(false);
      return;
    }
    // TODO: Implement image upload
    console.log("Image upload clicked");
    setExpanded(false);
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
    <div className="flex-row items-center bg-[#1e1e1e] p-2 rounded-xl shadow-md flex">
      {/* Expandable + menu */}
      <div className="relative mr-2" ref={menuRef}>
        <button
          onClick={toggleExpanded}
          disabled={disabled}
          className={`p-2 rounded-full transition-all duration-200 ${
            expanded ? 'bg-[#F4E5D9] text-black' : 'bg-[#B2BDA3] text-white hover:bg-[#B2BDA3]/90'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="More options"
        >
          <Plus 
            size={20} 
            className={`transition-transform duration-200 ${expanded ? 'rotate-45' : 'rotate-0'}`} 
          />
        </button>

        {/* Expanded menu */}
        {expanded && (
          <div className="absolute bottom-12 left-0 flex flex-col space-y-2 animate-in fade-in-0 zoom-in-95 duration-200">
            {/* Mic button */}
            <button
              onClick={handleMicClick}
              disabled={disabled || isProcessing}
              className={`p-3 rounded-full bg-[#1e1e1e] shadow-lg border border-gray-600 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                !isPremium ? 'opacity-50' : ''
              }`}
              title={!isPremium ? "Voice recording (Core/Studio only)" : "Voice recording"}
            >
              <Mic size={20} className="text-white" />
            </button>

            {/* Image button */}
            <button
              onClick={handleImageClick}
              disabled={disabled || isProcessing}
              className={`p-3 rounded-full bg-[#1e1e1e] shadow-lg border border-gray-600 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                !isPremium ? 'opacity-50' : ''
              }`}
              title={!isPremium ? "Upload image (Core/Studio only)" : "Upload image"}
            >
              <ImageIcon size={20} className="text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Center: Text input */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        className="flex-1 px-3 py-2 text-white bg-transparent border border-[#B2BDA3] rounded-lg placeholder-gray-400 focus:outline-none focus:border-[#F4E5D9] focus:ring-1 focus:ring-[#F4E5D9]"
        disabled={isProcessing || disabled}
      />

      {/* Send button (always visible) */}
      <button
        onClick={handleSubmit}
        disabled={isProcessing || disabled || !inputValue.trim()}
        className="p-2 ml-2 rounded-lg bg-[#F4E5D9] hover:bg-[#F4E5D9]/90 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
      >
        <Send size={20} className="text-black" />
      </button>

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
    </div>
  );
};

export default ChatInputBar;
