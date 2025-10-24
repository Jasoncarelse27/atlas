import { AnimatePresence, motion } from 'framer-motion';
import { Image as ImageIcon, Mic, MoreHorizontal, Paperclip, Send, Settings, Volume2, VolumeX, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
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
    <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 pointer-events-none unified-input-bar z-[999] bg-gradient-to-t from-black/30 via-black/10 to-transparent dark:from-black/50 dark:via-black/20 flex items-center justify-center">
      <div className="max-w-4xl mx-auto relative">
        <div className={`backdrop-blur-md rounded-full border shadow-lg flex items-center h-14 relative pointer-events-auto ${
          isFocused && currentMode === 'text' ? 'ring-1 ring-atlas-sage/50' : ''
        } dark:bg-gray-900/90 dark:border-gray-700 bg-white/90 border-gray-300 px-2`}>
          
          {/* Mute Toggle Button - Always visible */}
          {currentMode === 'voice' && (
            <Tooltip content={isMuted ? "Unmute audio" : "Mute audio"} position="top">
              <button
                onClick={() => {
                  handleMuteToggle();
                  if (onSoundPlay) onSoundPlay('toggle');
                }}
                className="p-2 rounded-full dark:text-gray-400 text-gray-600 dark:hover:text-gray-200 hover:text-gray-800 dark:hover:bg-gray-800/50 hover:bg-gray-200/50 transition-colors"
                aria-label={isMuted ? "Unmute audio" : "Mute audio"}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </Tooltip>
          )}
          
          <input
            ref={textInputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Ask anything..."
            className="flex-1 bg-transparent border-none outline-none px-5 py-2 focus:ring-0 focus:outline-none dark:text-white text-gray-900 dark:placeholder-gray-400 placeholder-gray-500"
            disabled={isProcessing || isListening}
            autoComplete="off"
          />

          {/* Voice Mode Controls */}
          {currentMode === 'voice' && (
            <div className="flex items-center">
              <button
                onMouseDown={onPressStart}
                onMouseUp={onPressEnd}
                onTouchStart={onPressStart}
                onTouchEnd={onPressEnd}
                disabled={isProcessing}
                className={`p-3 rounded-full transition-all duration-300 mr-2 ${
                  isListening 
                    ? 'bg-red-500 text-white' 
                    : 'bg-atlas-sage text-white'
                }`}
              >
                <Mic className="w-5 h-5" />
              </button>
            </div>
          )}
          
          <input
            type="file"
            id="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
            disabled={isProcessing || isListening}
          />
          
          <button
            onClick={handleSend}
            disabled={!message.trim() || isProcessing || isListening}
            className={`p-2 mr-2 rounded-full transition-colors focus:outline-none focus:ring-0 ${
              message.trim() && !isProcessing && !isListening  
                ? 'dark:text-atlas-sage text-atlas-sage dark:hover:text-blue-300 hover:text-atlas-sage dark:hover:bg-gray-800/50 hover:bg-gray-200/50'
                : 'dark:text-gray-600 text-gray-400'
            }`}
            aria-label="Send message"
          >
            {isProcessing ? (
              <LoadingSpinner size="sm" color="blue" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>

          {currentMode === 'voice' && onShowVoiceSettings && (
            <button
              onClick={() => {
                if (onSoundPlay) onSoundPlay('click');
                onShowVoiceSettings();
                setShowActions(false);
              }}
              className="flex items-center gap-3 px-4 py-2 dark:hover:bg-gray-700/70 hover:bg-gray-100/70 rounded-xl transition-colors whitespace-nowrap dark:text-white text-gray-900"
            >
              <Settings className="w-5 h-5 text-atlas-sage" />
              <span>Voice Settings</span>
            </button>
          )}
          
          <button
            onClick={handleToggleActions}
            className="p-2 dark:text-gray-400 text-gray-600 dark:hover:text-gray-200 hover:text-gray-800 dark:hover:bg-gray-800/50 hover:bg-gray-200/50 rounded-full transition-colors mr-2 focus:outline-none focus:ring-0"
            aria-label="More actions"
          > 
            <MoreHorizontal className="w-5 h-5" />
          </button>
          
          {/* Action Menu */}
          <AnimatePresence>
            {showActions && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }} 
                transition={{ duration: 0.2 }} 
                className="absolute right-0 bottom-16 dark:bg-gray-800/95 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl dark:border-gray-700 border-gray-300 p-2 flex flex-col gap-1"
              >
                <button
                  onClick={() => {
                    handleMuteToggle();
                    setShowActions(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2 dark:hover:bg-gray-700/70 hover:bg-gray-100/70 rounded-xl transition-colors whitespace-nowrap dark:text-white text-gray-900"
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
                  className="flex items-center gap-3 px-4 py-2 dark:hover:bg-gray-700/70 hover:bg-gray-100/70 rounded-xl transition-colors whitespace-nowrap dark:text-white text-gray-900"
                >
                  <ImageIcon className="w-5 h-5 text-purple-500" />
                  <span>Upload Image</span>
                </button>
                
                <button 
                  onClick={() => {
                    if (onSoundPlay) onSoundPlay('click');
                    setShowActions(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2 dark:hover:bg-gray-700/70 hover:bg-gray-100/70 rounded-xl transition-colors whitespace-nowrap dark:text-white text-gray-900"
                >
                  <Paperclip className="w-5 h-5 text-atlas-sage" />
                  <span>Attach File</span>
                </button>
                
                <button 
                  onClick={() => {
                    if (onSoundPlay) onSoundPlay('click');
                    setShowActions(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2 dark:hover:bg-gray-700/70 hover:bg-gray-100/70 rounded-xl transition-colors whitespace-nowrap dark:text-white text-gray-900"
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