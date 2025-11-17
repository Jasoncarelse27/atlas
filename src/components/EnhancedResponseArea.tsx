import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { Volume2, Copy, Check, ExternalLink, MessageSquare, Bot, User, Mic, Image as ImageIcon, Lightbulb, Clock, RefreshCw, ThumbsUp, ThumbsDown, Bookmark, Share2, Zap, Wifi } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import Tooltip from './Tooltip';
import AudioPlayer from './AudioPlayer';
import TypingIndicator from './TypingIndicator';
import ContextualSuggestions from './ContextualSuggestions';
import StatusIndicator from './StatusIndicator';
import { logger } from '../lib/logger';
import type { SoundType } from '../hooks/useSoundEffects';

interface EnhancedResponseAreaProps {
  response: string;
  isLoading: boolean;
  mode?: 'text' | 'voice' | 'image';
  transcript?: string;
  isListening?: boolean;
  audioUrl?: string | null;
  connectionStatus?: 'online' | 'offline' | 'connecting';
  onShowVoiceSettings?: () => void;
  className?: string;
  onSoundPlay?: (soundType: SoundType) => void;
}

const EnhancedResponseArea = forwardRef<HTMLDivElement, EnhancedResponseAreaProps>(({ 
  response, 
  isLoading, 
  mode = 'voice',
  transcript = '',
  isListening = false,
  audioUrl = null,
  connectionStatus = 'online',
  onShowVoiceSettings,
  className = '',
  onSoundPlay
}, ref) => {
  const [copied, setCopied] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [typingIndex, setTypingIndex] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const responseRef = useRef<HTMLDivElement>(null);

  // Simulate typing effect when response changes
  useEffect(() => {
    if (!response || isLoading) {
      setShowTyping(false);
      setTypingText('');
      setTypingIndex(0);
      return;
    }

    setShowTyping(true);
    setTypingText('');
    setTypingIndex(0);

    const typingInterval = setInterval(() => {
      setTypingIndex(prev => {
        if (prev >= response.length) {
          clearInterval(typingInterval);
          setShowTyping(false);
          return prev;
        }
        return prev + 1;
      });
      
      setTypingText(response.substring(0, typingIndex + 1));
    }, 20); // Faster typing speed for better UX

    return () => clearInterval(typingInterval);
  }, [response, isLoading]);

  // Scroll to bottom when response updates
  useEffect(() => {
    if (responseRef.current && (response || isLoading)) {
      responseRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [response, typingText, isLoading]);

  const copyToClipboard = async (text: string) => {
    try {
      // ✅ MOBILE FIX: Use native clipboard API with fallback for mobile Safari
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Mobile Safari fallback
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-999999px';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      if (onSoundPlay) {
        onSoundPlay('click');
      }
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Clipboard operation failure is non-critical
      logger.debug('[Copy] Failed to copy:', err);
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    if (onSoundPlay) {
      onSoundPlay('click');
    }
  };

  const handleFeedback = (type: 'up' | 'down') => {
    setFeedbackGiven(type);
    if (type === 'down') {
      setShowFeedbackForm(true);
    }
    if (onSoundPlay) {
      onSoundPlay('click');
    }
  };

  const handleSubmitFeedback = () => {
    setShowFeedbackForm(false);
    if (onSoundPlay) {
      onSoundPlay('success');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Atlas Response',
          text: response,
          url: window.location.href
        });
        if (onSoundPlay) {
          onSoundPlay('success');
        }
      } catch (err) {
        // Clipboard write failure is non-critical
      }
    } else {
      copyToClipboard(response);
    }
  };

  const getLoadingMessage = () => {
    switch (mode) {
      case 'image': return 'Analyzing image...';
      case 'voice': return 'Processing your voice input...';
      case 'text': return 'Generating response...';
      default: return 'Processing...';
    }
  };

  const getModeIcon = () => {
    switch (mode) {
      case 'image': return <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />;
      case 'voice': return <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />;
      case 'text': return <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-atlas-sage" />;
      default: return <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />;
    }
  };

  // Extract potential context from response for suggestions
  const extractContext = () => {
    const contexts: string[] = [];
    
    if (response.toLowerCase().includes('weather')) contexts.push('weather');
    if (response.toLowerCase().includes('schedule') || response.toLowerCase().includes('meeting')) contexts.push('productivity');
    if (response.toLowerCase().includes('learn') || response.toLowerCase().includes('understand')) contexts.push('learning');
    if (response.toLowerCase().includes('recipe') || response.toLowerCase().includes('food')) contexts.push('cooking');
    if (response.toLowerCase().includes('travel') || response.toLowerCase().includes('trip')) contexts.push('travel');
    
    return contexts;
  };

  const getPlaceholderMessage = () => {
    const messages = [
      "Ask me anything! I'm here to help with your questions.",
      "Ready to assist you with information, tasks, and more.",
      "What would you like to know or discuss today?",
      "I'm listening and ready to provide helpful responses."
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  return (
    <div className={`w-full space-y-4 response-area ${className}`} ref={ref || responseRef}>
      {/* Enhanced Placeholder Message - Only show for voice mode */}
      {!response && !isLoading && !isListening && !audioUrl && mode === 'voice' && (
        <div className="text-center my-6 sm:my-8">
          <div className="dark:bg-gradient-to-br dark:from-gray-900/80 dark:to-gray-800/60 bg-gradient-to-br from-white/80 to-gray-50/60 backdrop-blur-md rounded-xl dark:border-gray-700 border-gray-300 p-6 sm:p-10 shadow-xl relative overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-accent/5 animate-pulse pointer-events-none" />
            
            <div className="relative space-y-3 sm:space-y-4">
              <div className="relative mx-auto w-12 h-12 sm:w-16 sm:h-16">
                <div className="w-12 h-12 sm:w-16 sm:h-16 dark:bg-gradient-to-br dark:from-primary/20 dark:to-accent/20 bg-gradient-to-br from-primary/40 to-accent/40 rounded-full flex items-center justify-center shadow-lg">
                  <div className="relative">
                    <Volume2 className="w-6 h-6 sm:w-8 sm:h-8 dark:text-primary text-primary" />
                    <div className="absolute -top-1 -right-1">
                      <StatusIndicator 
                        status={connectionStatus} 
                        size="sm" 
                        showText={false}
                      />
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 dark:bg-primary/10 bg-primary/20 rounded-full animate-ping" />
              </div>
              
              <h3 className="text-xl sm:text-2xl font-bold dark:text-white text-gray-900">
                Ready to Help
              </h3>
              
              <p className="dark:text-gray-300 text-gray-700 text-base sm:text-lg leading-relaxed">
                {getPlaceholderMessage()}
              </p>
              
              <div className="grid grid-cols-1 gap-3 sm:gap-4 mt-4 sm:mt-6 text-sm">
                <div className="flex items-center gap-2 sm:gap-3 dark:text-gray-300 text-gray-700 dark:bg-gray-800/80 bg-gray-100 rounded-lg p-2 sm:p-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 dark:bg-primary bg-primary rounded-full" />
                  <span>Hold to record</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 dark:text-gray-300 text-gray-700 dark:bg-gray-800/80 bg-gray-100 rounded-lg p-2 sm:p-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 dark:bg-primary bg-primary rounded-full" />
                  <span>Release to send</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 dark:text-gray-300 text-gray-700 dark:bg-gray-800/80 bg-gray-100 rounded-lg p-2 sm:p-3">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 dark:bg-primary bg-primary rounded-full" />
                  <span>Toggle audio responses</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transcript Display - Dark theme */}
      {isListening && transcript && transcript.trim() && (
        <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-sm rounded-3xl border border-gray-700 p-3 sm:p-4 relative overflow-hidden shadow-lg">
          {/* Subtle animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 animate-pulse" />
          
          <div className="relative flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="relative">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping opacity-75" />
                </div>
                <User className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                <span className="text-xs text-green-400 font-medium">Listening...</span>
              </div>
              <div className="text-white leading-relaxed text-sm sm:text-base font-medium whitespace-pre-wrap tracking-wide">
                {transcript}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading State */}
      {isLoading && (
        <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-sm rounded-3xl border border-gray-700 p-3 sm:p-4 shadow-lg">
          <div className="flex flex-col items-center space-y-3 sm:space-y-4">
            <div className="relative">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 flex items-center justify-center">
                <LoadingSpinner size="sm" color="primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 bg-white dark:bg-gray-800 rounded-full">
                {getModeIcon()}
              </div>
            </div>
            
            <div className="text-center space-y-1 sm:space-y-2">
              <h3 className="text-base sm:text-lg font-semibold text-white">{getLoadingMessage()}</h3>
              <p className="text-gray-300 text-xs">
                Atlas is working on your request...
              </p>
            </div>
            
            <TypingIndicator isVisible={true} variant="wave" />
          </div>
        </div>
      )}
      
      {/* Response Display */}
      {!isLoading && response && (
        <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-sm rounded-3xl border border-gray-700 p-3 sm:p-4 shadow-lg">
          {/* Audio Player */}
          {audioUrl && (
            <div className="mb-3 sm:mb-4">
              <AudioPlayer
                audioUrl={audioUrl}
                title="Atlas Audio Response"
                autoPlay={mode === 'voice'}
                variant="compact"
                showWaveform={true}
              />
            </div>
          )}
          
          {/* Text Response */}
          <div className="relative">
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-900/50 rounded-lg">
                  <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-atlas-sage" />
                </div>
                <div>
                  <span className="font-semibold text-gray-900 text-xs sm:text-sm">Atlas Response</span>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Just now</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Tooltip content={copied ? "Copied!" : "Copy response"} position="left">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      copyToClipboard(response);
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    className="neumorphic-button min-w-[44px] min-h-[44px] p-2 text-gray-500 hover:text-gray-700 active:text-gray-800 transition-colors rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
                    style={{ touchAction: 'manipulation' }}
                    aria-label="Copy response"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </Tooltip>
                
                <Tooltip content={isBookmarked ? "Remove bookmark" : "Bookmark this response"} position="left">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleBookmark();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    className={`neumorphic-button min-w-[44px] min-h-[44px] p-2 transition-colors rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation ${
                      isBookmarked ? 'text-yellow-500 hover:text-yellow-600 active:text-yellow-700' : 'text-gray-500 hover:text-gray-700 active:text-gray-800'
                    }`}
                    style={{ touchAction: 'manipulation' }}
                    aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this response"}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-yellow-500' : ''}`} />
                  </button>
                </Tooltip>
                
                <Tooltip content="Share response" position="left">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleShare();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    className="neumorphic-button min-w-[44px] min-h-[44px] p-2 text-gray-500 hover:text-gray-700 active:text-gray-800 transition-colors rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
                    style={{ touchAction: 'manipulation' }}
                    aria-label="Share response"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
                
                {audioUrl && (
                  <Tooltip content="Open audio in new tab" position="left">
                    <a
                      href={audioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="neumorphic-button p-1.5 text-gray-500 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100"
                      aria-label="Open audio in new tab"
                      onClick={() => onSoundPlay?.('click')}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </Tooltip>
                )}
              </div>
            </div>
            
            <div className="bg-gray-800/80 rounded-2xl p-2.5 sm:p-3.5 border border-gray-700">
              {showTyping ? (
                <div className="text-gray-200 leading-relaxed whitespace-pre-wrap text-xs sm:text-sm">
                  {typingText}
                  <span className="inline-block w-1.5 h-3 sm:w-2 sm:h-4 bg-atlas-sage ml-1 animate-pulse"></span>
                </div>
              ) : (
                <div className="text-gray-800 leading-relaxed whitespace-pre-wrap text-xs sm:text-sm">
                  {response}
                </div>
              )}
            </div>
            
            {/* Feedback Controls */}
            <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-between">
              <div className="flex items-center gap-2 mb-2 sm:mb-0 text-gray-300">
                <span className="text-xs">Was this helpful?</span>
                <Tooltip content="This was helpful" position="top">
                  <button
                    onClick={() => handleFeedback('up')}
                    className={`neumorphic-button p-1.5 rounded-lg transition-colors ${
                      feedbackGiven === 'up' 
                        ? 'bg-green-100 text-green-600' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                    }`}
                    aria-label="This was helpful"
                    disabled={feedbackGiven !== null}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
                <Tooltip content="This wasn't helpful" position="top">
                  <button
                    onClick={() => handleFeedback('down')}
                    className={`neumorphic-button p-1.5 rounded-lg transition-colors ${
                      feedbackGiven === 'down' 
                        ? 'bg-red-100 text-red-600' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                    }`}
                    aria-label="This wasn't helpful"
                    disabled={feedbackGiven !== null}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              </div>
              
              <button
                onClick={() => {
                  if (onSoundPlay) onSoundPlay('click');
                }} 
                className="px-2 py-1 bg-blue-900/80 hover:bg-blue-800/80 text-blue-300 rounded-full text-xs transition-colors flex items-center gap-1.5 border border-blue-700"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Regenerate</span>
              </button>
            </div>
            
            {/* Feedback Form */}
            {showFeedbackForm && (
              <div className="mt-3 sm:mt-4 p-3 bg-red-50 rounded-2xl border border-red-200">
                <h4 className="text-xs font-medium text-red-700 mb-2">What was wrong with this response?</h4>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="neumorphic-input w-full p-2 border border-red-200 rounded-xl text-xs mb-3"
                  placeholder="Please tell us how we can improve..."
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowFeedbackForm(false);
                      if (onSoundPlay) onSoundPlay('click');
                    }}
                    className="neumorphic-button px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitFeedback}
                    className="neumorphic-button px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs"
                  >
                    Submit Feedback
                  </button>
                </div>
              </div>
            )}
            
            {/* Contextual Suggestions */}
            <div className="mt-4 sm:mt-5">
              <ContextualSuggestions
                message={response}
                context={extractContext()}
                onSoundPlay={onSoundPlay}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

EnhancedResponseArea.displayName = 'EnhancedResponseArea';

export default EnhancedResponseArea;