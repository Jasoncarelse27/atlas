// Atlas Business Chat Panel Component
// Chat interface with memory-aware AI that saves conversations as notes

import { MessageSquare, Send } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { useBusinessChat } from '../../hooks/useAgentsDashboard';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const BusinessChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const businessChatMutation = useBusinessChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || businessChatMutation.isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput('');

    try {
      const response = await businessChatMutation.mutateAsync(currentInput);
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      // Error handled by mutation hook (toast)
      // Optionally add error message to chat
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-[400px] sm:h-[500px]">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-[#B2BDA3] dark:text-[#B2BDA3]" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            Business Chat
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
          Chat with Atlas about your business. Conversations are saved as notes.
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 dark:text-gray-600 mb-3" />
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-1">Start a conversation</p>
            <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500">
              Ask Atlas about your business or share ideas
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-lg p-2.5 sm:p-3 ${
                  message.role === 'user'
                    ? 'bg-[#B2BDA3] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Press Enter to send)"
            disabled={businessChatMutation.isLoading}
            className="flex-1 px-2.5 sm:px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#B2BDA3] dark:focus:ring-[#B2BDA3] resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || businessChatMutation.isLoading}
            className="px-3 sm:px-4 py-2 bg-[#B2BDA3] hover:bg-[#8FA67E] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-1 sm:gap-2 flex-shrink-0"
            aria-label="Send message"
          >
            {businessChatMutation.isLoading ? (
              <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-3 h-3 sm:w-4 sm:h-4" />
            )}
          </button>
        </div>
        {businessChatMutation.isLoading && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Atlas is thinking...
          </p>
        )}
      </div>
    </div>
  );
};

export default BusinessChatPanel;

