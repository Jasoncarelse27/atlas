import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMessageStore } from '../../stores/useMessageStore';
import type { Message } from '../../types/chat';
import { UpgradeButton } from '../UpgradeButton';
import { LegacyMessageRenderer, MessageRenderer } from './MessageRenderer';
import SystemMessage from './SystemMessage';

interface EnhancedMessageBubbleProps {
  message: Message;
  isLatest?: boolean;
  isTyping?: boolean;
}

export default function EnhancedMessageBubble({ message, isLatest = false, isTyping = false }: EnhancedMessageBubbleProps) {
  console.log("[RENDER] message:", message);
  
  const [isExpanded, setIsExpanded] = useState(false);

  // ✅ Determine if this message has image attachments
  const imageAttachments = message.metadata?.attachments?.filter(
    (att: any) => att.type === "image"
  ) || [];
  
  // Early return if message is invalid
  if (!message) {
    console.warn('Invalid message object:', message);
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
        type={message.messageType || 'info'}
        action={<UpgradeButton size="sm" />}
      />
    );
  }

  // For image/audio messages, use the new MessageRenderer directly
  if (message.type === 'image' || message.type === 'audio') {
    console.log("[RENDER] Rendering image/audio message with MessageRenderer");
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
            <MessageRenderer message={message} allMessages={useMessageStore.getState().messages} />
            
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
    console.log("[RENDER] Unexpected message type:", message.type, "falling back to debug renderer");
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

    // For assistant messages, show typing effect if it's the latest message
    if (isLatest && !isUser) {
      const timer = setTimeout(() => {
        if (currentIndex < messageContent.length) {
          setDisplayedText(messageContent.slice(0, currentIndex + 1));
          setCurrentIndex(currentIndex + 1);
        }
      }, 8); // Typing speed: 8ms per character (fast like before)

      return () => clearTimeout(timer);
    } else if (!isLatest) {
      // For older messages, show full content immediately
      setDisplayedText(messageContent);
    }
  }, [currentIndex, messageContent, isUser, isLatest]);

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
          <div className="text-sm leading-relaxed">
            <LegacyMessageRenderer content={displayedText} />
            {showTypingIndicator && (
              <motion.span
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="inline-block w-2 h-4 bg-current ml-1"
              />
            )}
          </div>

                {/* ✅ Render image attachments */}
                {imageAttachments.length > 0 && (
                  <div className="image-attachments mt-3 space-y-2">
                    {imageAttachments.map((img: any, idx: number) => (
                      <div
                        key={idx}
                        className="relative cursor-pointer bg-transparent"
                        onClick={() => setIsExpanded(!isExpanded)}
                      >
                        <motion.img
                          src={img.previewUrl || img.url || message.metadata?.imageUrl}
                          alt={img.name || "uploaded image"}
                          className={`chat-image rounded-lg max-w-full h-auto transition-all duration-200 ${
                            isExpanded ? "max-w-none" : "max-w-xs cursor-pointer hover:opacity-90"
                          }`}
                          style={{ backgroundColor: 'transparent' }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          onError={(e) => {
                            console.warn("[ImageBubble] Failed to load", img, e);
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        
                        {/* ✅ Upload overlay with fade-out */}
                        <AnimatePresence>
                          {message.status === "uploading" && (
                            <motion.div
                              className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white text-sm rounded-lg"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <Loader2 className="w-5 h-5 animate-spin mb-1" />
                              Uploading...
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {!isExpanded && (
                          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 rounded-lg transition-all duration-200 flex items-center justify-center">
                            <span className="text-white text-xs opacity-0 hover:opacity-100 transition-opacity">
                              Click to expand
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
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
        </div>
      </div>
    </motion.div>
  );
}
