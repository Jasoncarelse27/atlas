import { AnimatePresence, motion } from 'framer-motion';
import { Image as ImageIcon, Mic, MoreHorizontal, Paperclip, Plus, Send, Settings, Volume2, VolumeX, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import Tooltip from '../../../components/Tooltip';
import type { SoundType } from '../hooks/useSoundEffects';

interface UnifiedInputBarProps { 
  currentMode: 'text' | 'voice' | 'image';
  isProcessing: boolean;
  isListening: boolean;
  isMuted: boolean;
  onSendMessage: (message: string) => void;
  onPressStart: () => void;
  onPressEnd: () => void;
  onImageSelect: (file: File) => void;
  onMuteToggle: () => void;
  onShowVoiceSettings?: () => void;
  onSoundPlay?: (soundType: SoundType) => void;
}

const UnifiedInputBar: React.FC<UnifiedInputBarProps> = ({
  currentMode,
  isProcessing,
  isListening,
  isMuted,
  onSendMessage,
  onPressStart,
  onPressEnd,
  onImageSelect,
  onMuteToggle,
  onShowVoiceSettings,
  onSoundPlay
}) => {
  const [message, setMessage] = useState('');
  const [showActions, setShowActions] = useState(false);  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);  
  
  // Focus text input when mode changes to text
  useEffect(() => {
    if (currentMode === 'text' && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [currentMode]);
  
  const handleSend = () => {
    if (message.trim() && !isProcessing) {
      onSendMessage(message.trim());
      setMessage('');
      if (onSoundPlay) onSoundPlay('send_message');
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelect(file);
      if (onSoundPlay) onSoundPlay('click');
    }
  };
  
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
    if (onSoundPlay) onSoundPlay('click');
  };
  
  const handleToggleActions = () => {
    setShowActions(!showActions);
    if (onSoundPlay) onSoundPlay('click');
  };
  
  const handleMuteToggle = () => {
    onMuteToggle();
    if (onSoundPlay) onSoundPlay('toggle');
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 pointer-events-none unified-input-bar z-[999] flex items-center justify-center">
      <div className="max-w-4xl mx-auto relative w-full">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Plus Button (Actions) - Peach background with black icon */}
          <button
            onClick={handleToggleActions}
            className="w-12 h-12 rounded-full bg-[#F4E5D9] dark:bg-[#F4E5D9] flex items-center justify-center transition-colors hover:bg-[#F3D3B8] dark:hover:bg-[#F3D3B8] focus:outline-none focus:ring-2 focus:ring-[#F4E5D9]/50"
            aria-label="More actions"
          > 
            <Plus className="w-5 h-5 text-[#1F2937] dark:text-[#1F2937]" />
          </button>

          {/* Text Input Field - Dark blue-gray background, rectangular */}
          <div className="flex-1 relative">
            <input
              ref={textInputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask Atlas anything..."
              className={`w-full h-12 rounded-2xl bg-[#1A1D26] dark:bg-[#1A1D26] border-none outline-none px-5 py-2 focus:ring-0 focus:outline-none text-white placeholder-gray-400 ${
                isFocused ? 'ring-1 ring-[#F4E5D9]/30' : ''
              }`}
              disabled={isProcessing || isListening}
              autoComplete="off"
            />
          </div>

          {/* Mute Toggle Button - Only visible in voice mode */}
          {currentMode === 'voice' && (
            <Tooltip content={isMuted ? "Unmute audio" : "Mute audio"} position="top">
              <button
                onClick={() => {
                  handleMuteToggle();
                  if (onSoundPlay) onSoundPlay('toggle');
                }}
                className="w-12 h-12 rounded-full bg-[#1A1D26] dark:bg-[#1A1D26] flex items-center justify-center transition-colors hover:bg-[#2A2E3A] dark:hover:bg-[#2A2E3A] focus:outline-none focus:ring-2 focus:ring-[#F4E5D9]/50"
                aria-label={isMuted ? "Unmute audio" : "Mute audio"}
              >
                {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
              </button>
            </Tooltip>
          )}

          {/* Voice Mode Controls - Microphone button */}
          {currentMode === 'voice' && (
            <button
              onMouseDown={onPressStart}
              onMouseUp={onPressEnd}
              onTouchStart={onPressStart}
              onTouchEnd={onPressEnd}
              disabled={isProcessing}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                isListening 
                  ? 'bg-red-500 text-white' 
                  : 'bg-[#1A1D26] dark:bg-[#1A1D26] text-white hover:bg-[#2A2E3A] dark:hover:bg-[#2A2E3A]'
              }`}
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
          
          {/* Hidden file input */}
          <input
            type="file"
            id="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
            disabled={isProcessing || isListening}
          />
          
          {/* Send Button - Always visible, darker gray background with black icon */}
          <button
            onClick={handleSend}
            disabled={!message.trim() || isProcessing || isListening}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#F4E5D9]/50 ${
              message.trim() && !isProcessing && !isListening  
                ? 'bg-[#2A2E3A] dark:bg-[#2A2E3A] text-[#1F2937] dark:text-[#1F2937] hover:bg-[#3A3E4A] dark:hover:bg-[#3A3E4A]'
                : 'bg-[#2A2E3A] dark:bg-[#2A2E3A] text-gray-500 dark:text-gray-500 cursor-not-allowed'
            }`}
            aria-label="Send message"
          >
            {isProcessing ? (
              <LoadingSpinner size="sm" color="white" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>

          {/* Voice Settings Button - Only visible in voice mode */}
          {currentMode === 'voice' && onShowVoiceSettings && (
            <button
              onClick={() => {
                if (onSoundPlay) onSoundPlay('click');
                onShowVoiceSettings();
                setShowActions(false);
              }}
              className="hidden sm:flex items-center gap-3 px-4 py-2 bg-[#1A1D26] dark:bg-[#1A1D26] hover:bg-[#2A2E3A] dark:hover:bg-[#2A2E3A] rounded-xl transition-colors whitespace-nowrap text-white"
            >
              <Settings className="w-5 h-5 text-white" />
              <span>Voice Settings</span>
            </button>
          )}
          
          {/* Action Menu */}
          <AnimatePresence>
            {showActions && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }} 
                transition={{ duration: 0.2 }} 
                className="absolute left-0 bottom-16 bg-white/95 dark:bg-[#1A1D26]/95 backdrop-blur-md rounded-2xl shadow-xl border-gray-300 dark:border-[#2A2E3A] p-2 flex flex-col gap-1 z-50"
              >
                <button
                  onClick={() => {
                    handleMuteToggle();
                    setShowActions(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100/70 dark:hover:bg-[#2A2E3A]/70 rounded-xl transition-colors whitespace-nowrap text-gray-900 dark:text-white"
                >
                  {isMuted ? (
                    <> 
                      <Mic className="w-5 h-5 dark:text-gray-400 text-gray-500" />
                      <span>Enable Audio</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5 text-red-500" />
                      <span>Disable Audio</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    handleFileButtonClick();
                    setShowActions(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100/70 dark:hover:bg-[#2A2E3A]/70 rounded-xl transition-colors whitespace-nowrap text-gray-900 dark:text-white"
                >
                  <ImageIcon className="w-5 h-5 text-purple-500" />
                  <span>Upload Image</span>
                </button>
                
                <button 
                  onClick={() => {
                    if (onSoundPlay) onSoundPlay('click');
                    setShowActions(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100/70 dark:hover:bg-[#2A2E3A]/70 rounded-xl transition-colors whitespace-nowrap text-gray-900 dark:text-white"
                >
                  <Paperclip className="w-5 h-5 text-atlas-sage" />
                  <span>Attach File</span>
                </button>
                
                <button 
                  onClick={() => {
                    if (onSoundPlay) onSoundPlay('click');
                    setShowActions(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100/70 dark:hover:bg-[#2A2E3A]/70 rounded-xl transition-colors whitespace-nowrap text-gray-900 dark:text-white"
                >
                  <X className="w-5 h-5 dark:text-gray-400 text-gray-500" />
                  <span>Close</span>
                </button>
              </motion.div>
            )} 
          </AnimatePresence>
        </div>
      </div> 
    </div>  
  );
};

export default UnifiedInputBar;