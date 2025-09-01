import { Bot, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { Message } from '../types/chat';

interface MessageRendererProps {
  message: Message;
  isLastMessage?: boolean;
  onRetry?: () => void;
}

const MessageRenderer: React.FC<MessageRendererProps> = ({ 
  message, 
  isLastMessage = false,
  onRetry 
}) => {
  const isUser = message.role === 'user';
  const isBot = message.role === 'assistant';
  
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const TypewriterText: React.FC<{ text: string; isStreaming: boolean }> = ({ text, isStreaming }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [wordIndex, setWordIndex] = useState(0);

    const words = text ? text.split(' ') : [];

    useEffect(() => {
      if (!isStreaming) {
        setDisplayedText(text || '');
        return;
      }

      if (wordIndex < words.length) {
        const timer = setTimeout(() => {
          setDisplayedText(words.slice(0, wordIndex + 1).join(' '));
          setWordIndex(prev => prev + 1);
        }, 50); // Adjust speed as needed

        return () => clearTimeout(timer);
      }
    }, [wordIndex, words, isStreaming, text]);

    useEffect(() => {
      // Reset when text changes (new chunks arrive)
      setWordIndex(0);
      setDisplayedText('');
    }, [text]);

    return (
      <div className="whitespace-pre-wrap text-gray-900">
        {displayedText}
        {isStreaming && (
          <span className="inline-flex ml-1">
            <span className="animate-pulse">•</span>
            <span className="animate-pulse animation-delay-200">•</span>
            <span className="animate-pulse animation-delay-400">•</span>
          </span>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (message.content.type === 'text') {
      const isStreaming = isBot && message.status === 'sending';
      return (
        <TypewriterText 
          text={message.content.text || ''} 
          isStreaming={isStreaming}
        />
      );
    }
    
    if (message.content.type === 'image') {
      return (
        <div className="space-y-2">
          <img 
            src={message.content.imageUrl} 
            alt="Uploaded content"
            className="max-w-full h-auto rounded-lg border border-gray-200"
          />
          {message.content.text && (
            <div className="whitespace-pre-wrap text-gray-900">
              {message.content.text}
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className={`flex gap-3 p-4 transition-opacity duration-300 ${
      isUser ? 'bg-blue-50' : 'bg-white'
    } ${isLastMessage ? 'border-b-0' : 'border-b border-gray-100'} ${
      message.status === 'sending' ? 'opacity-80' : 'opacity-100'
    }`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-600' : 'bg-gray-600'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>
      
      {/* Message Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-gray-900">
            {isUser ? 'You' : 'Atlas AI'}
          </span>
          <span className="text-xs text-gray-500">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
        
        <div className="prose prose-sm max-w-none">
          {renderContent()}
        </div>
        
        {/* Error state with retry option */}
        {message.status === 'failed' && onRetry && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 mb-2">
              Failed to send message{message.error ? `: ${message.error}` : ''}
            </p>
            <button
              onClick={onRetry}
              className="text-sm text-red-600 hover:text-red-700 underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageRenderer;
