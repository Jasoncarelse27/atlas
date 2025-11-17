import { Clock, Headphones, Mic, Paperclip, Plus, Send, Smile, Sparkles, Zap } from 'lucide-react';
import React, { forwardRef, useEffect, useRef, useState } from 'react';
import AnimatedBackground from '../components/AnimatedBackground';
import LoadingSpinner from '../components/LoadingSpinner';
import Tooltip from '../components/Tooltip';
import type { SoundType } from '../hooks/useSoundEffects';

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
  const [menuOpen, setMenuOpen] = useState(false);
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
            color="var(--atlas-sage, #D3DCAB)"
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
                    ? 'dark:bg-gradient-to-r dark:from-gray-800 dark:to-gray-700 dark:hover:from-atlas-stone/20 dark:hover:to-atlas-stone/10 bg-gradient-to-r from-gray-200 to-gray-100 hover:from-atlas-pearl hover:to-atlas-pearl dark:text-gray-300 text-gray-700 dark:border-gray-700 border-gray-300' 
                    : 'dark:bg-gray-800 dark:hover:bg-gray-700 bg-gray-200 hover:bg-gray-100 dark:text-gray-300 text-gray-700 dark:border-gray-700 border-gray-300'
                }`}
              >
                <Icon className="w-2.5 h-2.5 dark:text-atlas-sage text-atlas-sage" />
                <span className="line-clamp-1">{suggestion.text}</span>
              </button>
            );
          })}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="relative">
        {/* ✅ UNIFIED LAYOUT: Flex container matching mobile design */}
        <div className="flex items-center justify-between gap-2 bg-atlas-pearl dark:bg-gray-800 border border-atlas-border dark:border-gray-700 rounded-2xl px-3 py-2">
          {/* Left: "+" Attachment Button */}
          {showAttachments && (
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(!menuOpen);
                  if (onSoundPlay) onSoundPlay('click');
                }}
                disabled={isProcessing}
                className={`h-11 w-11 rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center flex-shrink-0 ${
                  menuOpen 
                    ? 'bg-atlas-sage text-gray-800' 
                    : 'bg-atlas-peach hover:bg-atlas-peach/80 text-gray-800'
                }`}
                title="Add attachment"
                aria-label="Add attachment"
              >
                <Plus size={18} className={`transition-transform duration-300 ${menuOpen ? 'rotate-45' : 'rotate-0'}`} />
              </button>
            </div>
          )}

          {/* Center: Text Input */}
          <div className="flex-1 flex flex-col min-w-0">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)} 
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className={`flex-1 w-full bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-atlas-sage/50 border border-atlas-border rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 resize-none min-h-[44px] max-h-[120px] transition-all duration-200 ease-in-out shadow-sm ${
                isFocused 
                  ? 'border-atlas-sage shadow-lg' 
                  : ''
              }`}
              style={{ fontSize: '16px' }}
              placeholder={placeholder}
              disabled={isProcessing}
              rows={1}
              maxLength={2000}
            />
            {/* Character Counter - Only show when >80% used */}
            {message.length > 1600 && (
              <div className={`text-right text-xs px-3 pb-1 ${
                message.length > 1900 ? 'text-red-500' : 'text-amber-500'
              }`}>
                {2000 - message.length} characters remaining
              </div>
            )}
          </div>

          {/* Right: Mic + Send Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Microphone Button (if voice supported) */}
            {showEmoji && (
              <Tooltip content="Voice input">
                <button
                  type="button"
                  className="h-11 w-11 rounded-full bg-atlas-stone hover:bg-atlas-stone/80 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center"
                  disabled={isProcessing}
                  onClick={() => {
                    if (onSoundPlay) onSoundPlay('click');
                    // TODO: Add voice input handler
                  }}
                  aria-label="Voice input"
                >
                  <Mic size={18} />
                </button>
              </Tooltip>
            )}
            
            {/* Send Button */}
            <Tooltip content={isProcessing ? "Processing..." : "Send message"}>
              <button
                type="submit"
                disabled={isProcessing || !message.trim()}
                className="h-11 w-11 rounded-full bg-atlas-sage hover:bg-atlas-stone text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center"
              >
                {isProcessing ? (
                  <LoadingSpinner size="sm" color="white" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </Tooltip>
          </div>
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