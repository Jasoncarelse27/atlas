import { AlertTriangle } from 'lucide-react';
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
          ${isUser ? 'max-w-[80%] px-4 py-3 rounded-2xl' : ''}
          ${isUser 
            ? 'bg-[#F4E5D9] dark:bg-gray-700 text-black dark:text-white rounded-br-md shadow-sm dark:shadow-gray-900/50' 
            : hasError 
              ? 'px-4 py-3 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
              : 'text-black dark:text-white'
          }
          ${isStreaming ? 'animate-pulse' : ''}
        `}
      >
        {hasError ? (
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span>{message.error}</span>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        )}
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
