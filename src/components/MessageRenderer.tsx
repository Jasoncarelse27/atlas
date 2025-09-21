import React from 'react';
import { useMessageStore, type ChatMessage } from '../stores/useMessageStore';

interface MessageRendererProps {
  className?: string;
}

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isStreaming = message.streaming;
  const hasError = !!message.error;
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`
          max-w-[80%] px-4 py-3 rounded-2xl
          ${isUser 
            ? 'bg-[#F4E5D9] text-black rounded-br-md' 
            : hasError 
              ? 'bg-red-100 text-red-800 border border-red-200'
              : 'bg-[#B2BDA3] text-white rounded-bl-md'
          }
          ${isStreaming ? 'animate-pulse' : ''}
          shadow-sm
        `}
      >
        {hasError ? (
          <div className="flex items-center space-x-2">
            <span className="text-red-500">⚠️</span>
            <span>{message.error}</span>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">
            {message.content}
            {isStreaming && (
              <span className="inline-block w-2 h-5 bg-current opacity-75 animate-pulse ml-1">|</span>
            )}
          </div>
        )}
        
        {/* Timestamp */}
        <div className={`text-xs mt-1 opacity-60 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </div>
  );
};

export const MessageRenderer: React.FC<MessageRendererProps> = ({ className = '' }) => {
  const { messages } = useMessageStore();
  
  return (
    <div className={`flex flex-col space-y-2 p-4 min-h-full ${className}`}>
      {messages.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <div className="text-center">
            <div className="text-2xl mb-2">💬</div>
            <p>Start a conversation with Atlas</p>
            <p className="text-sm mt-1">Your emotionally intelligent AI companion</p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {/* Spacer to ensure proper scrolling */}
          <div className="h-4" />
        </>
      )}
    </div>
  );
};

export default MessageRenderer;
