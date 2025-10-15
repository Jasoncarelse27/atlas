import { useTierAccess } from '@/hooks/useTierAccess';
import { audioUsageService } from '@/services/audioUsageService';
import { voiceService } from '@/services/voiceService';
import { motion } from 'framer-motion';
import { Bot, Loader2, User, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Message } from '../../types/chat';
import { UpgradeButton } from '../UpgradeButton';
import ImageMessageBubble from '../messages/ImageMessageBubble';
import { ImageGallery } from './ImageGallery';
import { LegacyMessageRenderer } from './MessageRenderer';
import { StopButton } from './StopButton';
import SystemMessage from './SystemMessage';
import { TypingDots } from './TypingDots';

interface EnhancedMessageBubbleProps {
  message: Message;
  isLatest?: boolean;
  isTyping?: boolean;
}

export default function EnhancedMessageBubble({ message, isLatest = false, isTyping = false }: EnhancedMessageBubbleProps) {
  

  // ✅ Collect all attachments (check both locations for compatibility)
  const attachments = message.attachments || [];
  
  // Early return if message is invalid
  if (!message) {
    return null;
  }

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // TTS state
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const { tier, userId, loading } = useTierAccess();

  // Debug: Log userId availability (only when there's an issue)
  useEffect(() => {
    // Only log if userId is null AND we're not still loading (indicates real timing issue)
    if (!userId && tier && !loading) {
      console.warn('[EnhancedMessageBubble] ⚠️ userId not yet available, tier:', tier);
    }
  }, [userId, tier, loading]);

  // Get content as string for typing effect
  const messageContent = message.content 
    ? (Array.isArray(message.content) ? message.content.join(' ') : message.content)
    : '';

  // Handle system messages
  if (isSystem) {
    return (
      <SystemMessage 
        text={messageContent} 
        type="info"
        action={<UpgradeButton size="sm" />}
      />
    );
  }

  // For attachment messages, render with custom attachment layout
  if (attachments.length > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1],
          delay: isLatest ? 0.1 : 0
        }}
        className={`flex items-start space-x-3 mb-6 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
      >
        {/* Avatar */}
        <div className={`flex-shrink-0 ${isUser ? 'ml-3' : 'mr-3'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-gradient-to-br from-[#B2BDA3] to-[#F4E5D9] text-gray-800'
          }`}>
            {isUser ? <User size={16} /> : <Bot size={16} />}
          </div>
        </div>

        {/* Message Content */}
        <div className={`flex-1 max-w-3xl ${isUser ? 'flex justify-end' : ''}`}>
          <div className={`relative px-4 py-3 rounded-2xl shadow-sm ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-gradient-to-br from-[#B2BDA3]/10 to-[#F4E5D9]/10 border border-[#B2BDA3]/20 text-gray-100 rounded-bl-md'
          }`}>
            {/* 🖼️ Enhanced Image Gallery */}
            {attachments.length > 0 && (
              <ImageGallery 
                attachments={attachments} 
                isUser={isUser}
              />
            )}

            {/* ✅ User Caption - Show caption text under images (only for user messages with attachments) */}
            {isUser && messageContent && messageContent.trim() && (
              <div className="mt-3 text-sm italic text-gray-300">
                {messageContent.replace(/^"|"$/g, '')}
              </div>
            )}

            {/* Timestamp */}
            {message.timestamp && (
              <div className={`text-xs mt-2 opacity-70 ${
                isUser ? 'text-blue-100' : 'text-gray-400'
              }`}>
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Handle non-text message types
  if (message.type && message.type !== 'text') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ 
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1],
          delay: isLatest ? 0.1 : 0
        }}
        className={`flex items-start space-x-3 mb-6 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
      >
        {/* Avatar */}
        <div className={`flex-shrink-0 ${isUser ? 'ml-3' : 'mr-3'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isUser 
              ? 'bg-blue-600 text-white' 
              : 'bg-gradient-to-br from-[#B2BDA3] to-[#F4E5D9] text-gray-800'
          }`}>
            {isUser ? <User size={16} /> : <Bot size={16} />}
          </div>
        </div>

        {/* Message Content - Debug Fallback */}
        <div className={`flex-1 max-w-3xl ${isUser ? 'flex justify-end' : ''}`}>
          <div className={`relative px-4 py-3 rounded-2xl shadow-sm ${
            isUser 
              ? 'bg-blue-600 text-white rounded-br-md' 
              : 'bg-gradient-to-br from-[#B2BDA3]/10 to-[#F4E5D9]/10 border border-[#B2BDA3]/20 text-gray-100 rounded-bl-md'
          }`}>
            <pre style={{ color: "red", fontSize: 12, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(message, null, 2)}
            </pre>
          </div>
        </div>
      </motion.div>
    );
  }

  // Typing effect for AI text messages - show word by word
  useEffect(() => {
    if (isUser) {
      // ✅ CRITICAL FIX: User messages should always show content immediately
      setDisplayedText(messageContent);
      return;
    }

    // For assistant messages, show typing effect if it's the latest message and not in sending state
    if (isLatest && !isUser && message.status !== 'sending') {
      const timer = setInterval(() => {
        setCurrentIndex(prevIndex => {
          if (prevIndex < messageContent.length) {
            setDisplayedText(messageContent.slice(0, prevIndex + 1));
            return prevIndex + 1;
          }
          return prevIndex;
        });
      }, 12); // Slightly slower for more natural ChatGPT-like effect

      return () => clearInterval(timer);
    } else {
      // ✅ CRITICAL FIX: For all other cases, show full content immediately
      setDisplayedText(messageContent);
    }
  }, [messageContent, isUser, isLatest, message.status]);

  // Reset typing effect when message changes
  useEffect(() => {
    if (isLatest && !isUser) {
      setDisplayedText('');
      setCurrentIndex(0);
    }
  }, [message.id, isLatest, isUser]);

  const showTypingIndicator = isLatest && !isUser && currentIndex < messageContent.length;
  
  // ✅ IMPROVED TTS handler with better error handling and debugging
  const handlePlayTTS = async () => {
    // Wait for auth to complete
    if (loading) {
      console.warn('[TTS] Waiting for authentication...');
      return;
    }
    
    if (!userId) {
      console.warn('[TTS] userId not available yet');
      toast.error('Please wait for authentication to complete');
      return;
    }
    
    if (!message.content) {
      console.warn('[TTS] message content is empty');
      return;
    }
    
    console.log('[TTS] Starting TTS playback for tier:', tier);
    
    // Check tier access
    if (tier === 'free') {
      toast.error('Text-to-speech requires Core or Studio tier');
      return;
    }
    
    setIsPlayingTTS(true);
    
    try {
      // ✅ FUTURE-PROOF: Check usage limits and stop gracefully if exceeded
      let usageCheck;
      try {
        usageCheck = await audioUsageService.checkAudioUsage(userId, tier);
        if (usageCheck && !usageCheck.canUse) {
          // Show user-friendly message and stop gracefully
          console.warn('[TTS] Usage limit reached:', usageCheck.warning);
          toast.warning(usageCheck.warning || 'Audio limit reached');
          toast.info('💡 Upgrade to Core tier for unlimited audio!');
          return; // Stop here - don't try to play empty audio
        }
      } catch (usageError) {
        console.warn('[TTS] Usage check failed, allowing playback:', usageError);
        // Continue anyway - don't block TTS for usage check failures
      }
      
      const text = typeof message.content === 'string' 
        ? message.content 
        : (message.content as any).text || message.content;
      
      console.log('[TTS] Synthesizing speech for text length:', text.length);
      
      // ✅ SAFER: Direct synthesis without cache for debugging
      let audioDataUrl;
      try {
        audioDataUrl = await voiceService.synthesizeSpeech(text);
        console.log('[TTS] Audio synthesized successfully');
      } catch (synthesisError) {
        console.error('[TTS] Synthesis failed:', synthesisError);
        throw synthesisError;
      }
      
      console.log('[TTS] Audio synthesized, playing...');
      
      // ✅ MOBILE FIX: Handle autoplay restrictions better
      try {
        await voiceService.playAudio(audioDataUrl);
        toast.success('Audio played');
      } catch (playError: any) {
        console.error('[TTS] Playback error:', playError);
        
        if (playError.message.includes('user interaction')) {
          toast.error('Tap Listen again to play audio');
        } else if (playError.message.includes('timeout')) {
          toast.error('Audio playback timed out');
        } else {
          toast.error('Audio playback failed: ' + playError.message);
        }
      }
      
    } catch (error) {
      console.error('[TTS] Full error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('requires Core or Studio')) {
          toast.error('Audio features require Core or Studio tier');
        } else if (error.message.includes('503')) {
          toast.error('Audio service temporarily unavailable');
        } else {
          toast.error('Audio generation failed: ' + error.message);
        }
      } else {
        toast.error('Audio playback failed');
      }
    } finally {
      setIsPlayingTTS(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
        delay: isLatest ? 0.1 : 0
      }}
      className={`flex items-start space-x-2 sm:space-x-3 mb-6 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`flex-shrink-0 ${isUser ? 'ml-2 sm:ml-3' : 'mr-2 sm:mr-3'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isUser 
            ? 'bg-blue-600 text-white' 
            : 'bg-gradient-to-br from-atlas-primary to-atlas-accent text-gray-800'
        }`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>
      </div>

      {/* Message Content */}
      <div className={`flex-1 ${isUser ? 'max-w-[75%] sm:max-w-[70%] md:max-w-[60%] flex justify-end' : 'w-full'}`}>
        <motion.div 
          className={`relative ${
            isUser 
              ? 'px-4 py-2 rounded-2xl bg-blue-600 text-white shadow-md text-[15px] leading-relaxed' 
              : 'px-5 py-3 text-atlas-accent max-w-none text-[16px] leading-relaxed'
          }`} 
          style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
          initial={{ opacity: 0, y: isUser ? 8 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: isUser ? 0.2 : 0.3, ease: "easeOut" }}
        >
          {(message.status === 'sending' && (!displayedText || displayedText === '...')) || (isTyping && !isUser) ? (
              <div className="flex items-center space-x-3 text-gray-300">
                <TypingDots />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <LegacyMessageRenderer content={displayedText} />
                  {showTypingIndicator && (
                    <motion.span
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="inline-block w-2 h-4 bg-current ml-1"
                    />
                  )}
                </div>
                {message.status === 'sending' && displayedText && !isUser && (
                  <StopButton 
                    onPress={() => {
                      // Stop generation logic will be implemented
                    }}
                    isVisible={true}
                  />
                )}
              </div>
            )}

          {/* 🖼️ Handle Image Messages Specifically */}
          {(message.type as string) === 'image' && (
            <ImageMessageBubble 
              message={message}
            />
          )}

          {/* 🖼️ Enhanced Image Gallery */}
          {attachments.length > 0 && (
            <ImageGallery 
              attachments={attachments} 
              isUser={isUser}
            />
          )}

          {/* ✅ User Caption - Show caption text under images (only for user messages with attachments) */}
          {isUser && messageContent && messageContent.trim() && attachments.length > 0 && (
            <div className="mt-3 text-sm italic text-gray-300">
              {messageContent.replace(/^"|"$/g, '')}
            </div>
          )}

          {/* ✅ Show uploading status */}
          {message.status === "uploading" && (
            <div className="mt-2 text-xs opacity-70 flex items-center">
              <span className="animate-spin mr-2">⏳</span>
              Uploading...
            </div>
          )}
          
          {/* TTS Button for AI messages */}
          {!isUser && !showTypingIndicator && message.status !== 'sending' && (
            <button
              onClick={handlePlayTTS}
              disabled={isPlayingTTS}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg 
                       bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 
                       border border-blue-500/20 transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Play audio"
            >
              {isPlayingTTS ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
              <span className="font-medium">
                {isPlayingTTS ? 'Playing...' : 'Listen'}
              </span>
            </button>
          )}
          
          {/* Timestamp */}
          {message.timestamp && !showTypingIndicator && (
            <div className={`text-xs mt-2 opacity-70 ${
              isUser ? 'text-blue-100' : 'text-gray-400'
            }`}>
              {new Date(message.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
