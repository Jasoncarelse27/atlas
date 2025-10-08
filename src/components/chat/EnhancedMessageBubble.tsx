import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Message } from '../../types/chat';
import { UpgradeButton } from '../UpgradeButton';
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

  // Debug fallback for unexpected message types
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
    } else if (!isLatest || message.status === 'sending') {
      // For older messages or sending state, show full content immediately
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
          initial={!isUser ? { opacity: 0, y: 4 } : {}}
          animate={!isUser ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {/* Debug logging removed - functionality working correctly */}
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
                      // TODO: Implement stop generation logic
                    }}
                    isVisible={true}
                  />
                )}
              </div>
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
