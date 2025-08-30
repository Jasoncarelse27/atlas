import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { Send, Paperclip, Smile, Headphones, Image as ImageIcon, X, Zap, Clock, Sparkles, Command } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import Tooltip from './Tooltip';
import type { SoundType } from '../hooks/useSoundEffects';
import AnimatedBackground from './AnimatedBackground';
import InputModeWrapper from './InputModeWrapper';

interface TextInputAreaProps {
  onSendMessage: (message: string) => void;
  isProcessing: boolean;
  placeholder?: string;
  className?: string;
  showAttachments?: boolean;
  showEmoji?: boolean;
  showSuggestions?: boolean;
  onSoundPlay?: (soundType: SoundType) => void;
}

const TextInputArea = forwardRef<HTMLDivElement, TextInputAreaProps>(({
  onSendMessage,
  isProcessing,
  placeholder = 'Type your message here...',
  className = '',
  showAttachments = true,
  showEmoji = true,
  showSuggestions = true,
  onSoundPlay
}, ref) => {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions] = useState([
    { text: 'What can you help me with?', icon: Zap },
    { text: 'Tell me about Atlas features', icon: Sparkles },
    { text: 'How do I use voice mode?', icon: Headphones },
    { text: 'What\'s new today?', icon: Clock }
  ]);
  const [showEnhancedUI, setShowEnhancedUI] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  // Auto-focus and scroll into view when component mounts
  useEffect(() => {
    if (textareaRef.current && !isProcessing) {
      textareaRef.current.focus();
      
      // Scroll the component into view if ref is provided
      if (ref && 'current' in ref && ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [isProcessing, ref]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!isProcessing && message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      
      // Play send message sound
      if (onSoundPlay) {
        onSoundPlay('send_message');
      }
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
    
    // Play click sound
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    
    setTimeout(() => handleSubmit(), 100);
  };

  const handleToggleEnhancedUI = () => {
    if (onSoundPlay) {
      onSoundPlay('toggle');
    }
    setShowEnhancedUI(!showEnhancedUI);
  };

  return (
    <div className={`w-full ${className} text-input-area relative`} ref={ref}>
      {/* Enhanced Background */}
      {showEnhancedUI && (
        <div className="absolute inset-0 -z-10 opacity-20 pointer-events-none">
          <AnimatedBackground 
            variant="gradient" 
            intensity="low" 
            color="var(--primary-color, #3B82F6)"
          />
        </div>
      )}
      
      {/* Suggestions */}
      {showSuggestions && !isProcessing && !message && (
        <div className="mb-2 sm:mb-3 flex flex-wrap gap-1 sm:gap-1.5 px-4 relative z-10">
          {suggestions.map((suggestion, index) => {
            const Icon = suggestion.icon;
            return (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion.text)}
                className={`px-2 py-1 sm:px-2.5 sm:py-1.5 text-gray-300 rounded-full text-2xs sm:text-xs flex items-center gap-1 shadow-sm border border-gray-700 ${
                  showEnhancedUI 
                    ? 'dark:bg-gradient-to-r dark:from-gray-800 dark:to-gray-700 dark:hover:from-blue-900 dark:hover:to-blue-800 bg-gradient-to-r from-gray-200 to-gray-100 hover:from-blue-100 hover:to-blue-50 dark:text-gray-300 text-gray-700 dark:border-gray-700 border-gray-300' 
                    : 'dark:bg-gray-800 dark:hover:bg-gray-700 bg-gray-200 hover:bg-gray-100 dark:text-gray-300 text-gray-700 dark:border-gray-700 border-gray-300'
                }`}
              >
                <Icon className="w-2.5 h-2.5 dark:text-blue-400 text-blue-600" />
                <span className="line-clamp-1">{suggestion.text}</span>
              </button>
            );
          })}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="relative">
        <div className={`relative transition-all duration-300 rounded-3xl px-4 ${
          isFocused 
            ? 'ring-1 ring-blue-500/30 dark:ring-blue-500/50' 
            : ''
        }`}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)} 
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={`w-full px-4 py-3 pr-12 dark:bg-gradient-to-br dark:from-gray-800/90 dark:to-gray-900/90 bg-gradient-to-br from-gray-100/90 to-white/90 dark:border-gray-700 border-gray-300 rounded-xl dark:text-white text-gray-900 dark:placeholder-gray-500 placeholder-gray-400 focus:outline-none min-h-[56px] resize-none transition-all duration-300 text-base leading-relaxed font-medium ${
              isFocused 
                ? 'dark:border-blue-500/60 border-blue-500/40 shadow-lg dark:shadow-blue-900/10 shadow-blue-500/10' 
                : 'dark:hover:border-gray-600 hover:border-gray-400'
            }`}
            placeholder={placeholder}
            disabled={isProcessing}
            rows={1}
            maxLength={2000}
          />
          <div className="absolute bottom-3 right-3 text-xs text-gray-500 font-medium">
            <span className="dark:text-gray-400 text-gray-500">{message.length}/2000</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="absolute bottom-1.5 sm:bottom-2 right-1.5 sm:right-2 flex items-center gap-1">
          {showAttachments && (
            <Tooltip content="Attach file">
              <button
                type="button"
                className={`p-1 hover:bg-gray-700 rounded-full transition-colors ${
                  showEnhancedUI ? 'dark:text-blue-400 dark:hover:text-blue-300 text-blue-600 hover:text-blue-500 dark:hover:bg-gray-700 hover:bg-gray-200' : 'dark:text-gray-400 dark:hover:text-gray-300 text-gray-600 hover:text-gray-700 dark:hover:bg-gray-700 hover:bg-gray-200'
                }`}
                disabled={isProcessing}
                onClick={() => onSoundPlay?.('click')}
              >
                <Paperclip className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </Tooltip>
          )}
          
          {showEmoji && (
            <Tooltip content="Add emoji">
              <button
                type="button"
                className={`p-1 hover:bg-gray-700 rounded-full transition-colors ${
                  showEnhancedUI ? 'dark:text-yellow-400 dark:hover:text-yellow-300 text-yellow-600 hover:text-yellow-500 dark:hover:bg-gray-700 hover:bg-gray-200' : 'dark:text-gray-400 dark:hover:text-gray-300 text-gray-600 hover:text-gray-700 dark:hover:bg-gray-700 hover:bg-gray-200'
                }`}
                disabled={isProcessing}
                onClick={() => onSoundPlay?.('click')}
              >
                <Smile className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </Tooltip>
          )}
          
          <Tooltip content={isProcessing ? "Processing..." : "Send message"}>
            <button
              type="submit"
              disabled={isProcessing || !message.trim()}
              className={`p-1.5 text-white rounded-full transition-colors disabled:opacity-50 ${
                showEnhancedUI
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:from-blue-600 disabled:to-blue-700'
                  : 'bg-blue-500 hover:bg-blue-400 disabled:hover:bg-blue-500' 
              }`}
            >
              {isProcessing ? (
                <LoadingSpinner size="sm" color="white" />
              ) : (
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>
          </Tooltip>
        </div>
        
        {/* Character Count and Keyboard Shortcuts */}
        <div className="mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-gray-500">
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1 sm:mb-0 dark:text-gray-400 text-gray-600">
            <div className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 dark:bg-gray-800 bg-gray-200 rounded dark:text-gray-300 text-gray-700 font-mono text-xs dark:border-gray-700 border-gray-300">Enter</kbd>
              <span>to send</span>
            </div>
            <span className="hidden sm:inline mx-1">•</span>
            <div className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 dark:bg-gray-800 bg-gray-200 rounded dark:text-gray-300 text-gray-700 font-mono text-xs dark:border-gray-700 border-gray-300">Shift+Enter</kbd>
              <span>for new line</span>
            </div>
            
            {/* Enhanced UI Toggle */}
            <button
              onClick={handleToggleEnhancedUI}
              className="ml-0 sm:ml-2 px-1.5 py-0.5 text-xs dark:bg-gray-800 bg-gray-200 dark:hover:bg-gray-700 hover:bg-gray-300 dark:text-gray-300 text-gray-700 rounded transition-colors flex items-center gap-1 dark:border-gray-700 border-gray-300"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>{showEnhancedUI ? 'Simple UI' : 'Enhanced UI'}</span>
            </button>
          </div>
          <span className={`font-mono ${message.length > 1500 ? 'text-orange-500' : 'dark:text-gray-500 text-gray-600'}`}>
            {message.length}/2000
          </span>
        </div>
      </form>
    </div>
  );
});

TextInputArea.displayName = 'TextInputArea';

export default TextInputArea;