import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Message } from '../../types/chat';
import { UpgradeButton } from '../UpgradeButton';
import { LegacyMessageRenderer } from './MessageRenderer';
import SystemMessage from './SystemMessage';

interface EnhancedMessageBubbleProps {
  message: Message;
  isLatest?: boolean;
  isTyping?: boolean;
}

export default function EnhancedMessageBubble({ message, isLatest = false }: EnhancedMessageBubbleProps) {
  
  const [isExpanded, setIsExpanded] = useState(false);

  // ✅ Collect all attachments (check both locations for compatibility)
  const attachments = message.attachments || [];
  
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
            {/* ✅ WhatsApp-style: All attachments in one bubble */}
            {attachments.length > 0 && (
              <div className="attachments mt-3">
                {/* ✅ Grid layout for multiple images */}
                <div className={`grid gap-2 ${
                  attachments.length === 1 ? 'grid-cols-1' : 
                  attachments.length === 2 ? 'grid-cols-2' : 
                  'grid-cols-2'
                }`}>
                  {attachments.map((att: any, idx: number) => (
                    <div key={idx} className="attachment-item">
                {/* Image */}
                {att.type === "image" && (
                  <div
                    className="relative cursor-pointer bg-transparent"
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    <motion.img
                      src={att.previewUrl || att.url}
                      alt={att.name || "uploaded image"}
                      className={`chat-image rounded-lg max-w-full h-auto transition-all duration-200 ${
                  isExpanded ? "max-w-none" : "max-w-xs cursor-pointer hover:opacity-90"
                      }`}
                      style={{ backgroundColor: 'transparent' }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    
                    {/* Upload overlay */}
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
                )}

                {/* Audio */}
                {att.type === "audio" && (
                  <div className="audio-attachment">
                    <audio
                      controls
                      src={att.previewUrl || att.url}
                      className="w-full rounded"
                    />
                  </div>
                )}

                {/* File */}
                {att.type === "file" && (
                  <div className="file-attachment">
                    <a
                      href={att.url || att.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline hover:text-blue-600"
                    >
                      📎 {att.name || "Download file"}
                    </a>
                  </div>
                )}
                    </div>
                  ))}
                </div>
                
                {/* ✅ Single caption below all attachments (WhatsApp-style) */}
                {message.content && message.content.trim() !== "" && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                    {message.content}
                  </p>
                )}
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
          {message.status === 'sending' && !displayedText ? (
              <div className="flex items-center space-x-3 text-gray-300">
                <div className="flex space-x-1">
                  <motion.div
                    className="w-2 h-2 bg-atlas-primary rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-atlas-primary rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-atlas-primary rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                  />
                </div>
                <span className="text-xs font-medium">Atlas is thinking...</span>
              </div>
            ) : (
              <>
                <LegacyMessageRenderer content={displayedText} />
                {showTypingIndicator && (
                  <motion.span
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="inline-block w-2 h-4 bg-current ml-1"
                  />
                )}
              </>
            )}

          {/* ✅ WhatsApp-style: All attachments in one bubble */}
          {attachments.length > 0 && (
            <div className="attachments mt-3">
              {/* ✅ Grid layout for multiple images */}
              <div className={`grid gap-2 ${
                attachments.length === 1 ? 'grid-cols-1' : 
                attachments.length === 2 ? 'grid-cols-2' : 
                'grid-cols-2'
              }`}>
                {attachments.map((att: any, idx: number) => (
                  <div key={idx} className="attachment-item">
                    {/* Image */}
                    {att.type === "image" && (
                      <div
                  className="relative cursor-pointer bg-transparent"
                  onClick={() => setIsExpanded(!isExpanded)}
                      >
                  <motion.img
                    src={att.previewUrl || att.url}
                    alt={att.name || "uploaded image"}
                    className={`chat-image rounded-lg max-w-full h-auto transition-all duration-200 ${
                      isExpanded ? "max-w-none" : "max-w-xs cursor-pointer hover:opacity-90"
                    }`}
                    style={{ backgroundColor: 'transparent' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  
                  {/* Upload overlay */}
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
                    )}

                    {/* Audio */}
                    {att.type === "audio" && (
                      <div className="audio-attachment">
                  <audio
                    controls
                    src={att.previewUrl || att.url}
                    className="w-full rounded"
                  />
                      </div>
                    )}

                    {/* File */}
                    {att.type === "file" && (
                      <div className="file-attachment">
                  <a
                    href={att.url || att.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline hover:text-blue-600"
                  >
                    📎 {att.name || "Download file"}
                  </a>
                      </div>
                    )}
                  </div>
                ))}
                    </div>
                    
                    {/* ✅ Single caption below all attachments (WhatsApp-style) */}
                    {message.content && message.content.trim() !== "" && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                  {message.content}
                </p>
                    )}
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
