import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { UpgradeButton } from '../UpgradeButton';
import SystemMessage from './SystemMessage';

interface EnhancedMessageBubbleProps {
  message: {
    id: string;
    content: string;
    role: 'user' | 'assistant' | 'system';
    timestamp?: string;
    messageType?: 'info' | 'warning' | 'error' | 'success';
  };
  isLatest?: boolean;
  isTyping?: boolean;
}

export default function EnhancedMessageBubble({ message, isLatest = false, isTyping = false }: EnhancedMessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Handle system messages
  if (isSystem) {
    return (
      <SystemMessage 
        text={message.content} 
        type={message.messageType || 'info'}
        action={<UpgradeButton size="sm" />}
      />
    );
  }

  // Typing effect for AI messages
  useEffect(() => {
    if (isUser || !isLatest || !isTyping) {
      setDisplayedText(message.content);
      return;
    }

    const timer = setTimeout(() => {
      if (currentIndex < message.content.length) {
        setDisplayedText(message.content.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }
    }, 8); // Typing speed: 8ms per character (very fast)

    return () => clearTimeout(timer);
  }, [currentIndex, message.content, isUser, isLatest, isTyping]);

  // Reset typing effect when message changes
  useEffect(() => {
    if (isLatest && !isUser) {
      setDisplayedText('');
      setCurrentIndex(0);
    }
  }, [message.id, isLatest, isUser]);

  const showTypingIndicator = isLatest && !isUser && isTyping && currentIndex < message.content.length;

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
          {/* Message Text */}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {displayedText}
            {showTypingIndicator && (
              <motion.span
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="inline-block w-2 h-4 bg-current ml-1"
              />
            )}
          </p>
          
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
        </div>
      </div>
    </motion.div>
  );
}
