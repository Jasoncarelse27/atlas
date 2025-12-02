// src/components/agents/WebAgentChat.tsx
// Web Agent Chat Component - FAQ, Onboarding, Tech Support
// Embedded in Atlas app (separate from main Atlas chat)

import { Send } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { getApiEndpoint } from '../../utils/apiClient';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../lib/logger';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface WebAgentChatProps {
  source?: 'rima_site' | 'atlas_app';
  className?: string;
}

export function WebAgentChat({ source = 'atlas_app', className = '' }: WebAgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get user ID on mount (optional - supports anonymous users)
  useEffect(() => {
    const getUserId = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          setUserId(session.user.id);
        }
      } catch (error) {
        logger.debug('[WebAgentChat] Could not get user ID (anonymous mode):', error);
      }
    };
    getUserId();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Get auth token if user is logged in (optional)
      let authToken: string | null = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        authToken = session?.access_token || null;
      } catch (error) {
        // Anonymous mode - no token needed
      }

      const response = await fetch(getApiEndpoint('/api/agents/web-support'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { Authorization: `Bearer ${authToken}` })
        },
        body: JSON.stringify({
          message: userMessage.content,
          source: source
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.ok && data.response) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Show escalation notice if escalated
        if (data.escalated) {
          logger.info('[WebAgentChat] Conversation escalated:', data.incidentId);
        }
      } else {
        throw new Error(data.error || 'Failed to get response');
      }

    } catch (error) {
      logger.error('[WebAgentChat] Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again or contact support if the issue persists.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-gray-900 text-white ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold">Atlas Support</h3>
        <p className="text-sm text-gray-400">Ask questions about Atlas features, pricing, or get help</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p className="mb-2">👋 Hi! I'm here to help with:</p>
            <ul className="text-sm space-y-1 text-left max-w-md mx-auto">
              <li>• Atlas features and usage</li>
              <li>• Account and billing questions</li>
              <li>• Technical support</li>
              <li>• Onboarding guidance</li>
            </ul>
            <p className="mt-4 text-xs">Ask me anything!</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-atlas-sage text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg px-4 py-2">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question..."
            className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 resize-none min-h-[44px] max-h-32 outline-none focus:ring-2 focus:ring-atlas-sage"
            rows={1}
            disabled={isLoading}
            style={{
              height: 'auto',
              minHeight: '44px'
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 128) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-atlas-sage hover:bg-atlas-success disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          This is a support chatbot. For emotional support, use the main Atlas chat.
        </p>
      </div>
    </div>
  );
}

// Export embeddable version for external sites
export function WebAgentEmbed({ source = 'rima_site' }: { source?: 'rima_site' | 'atlas_app' }) {
  return (
    <div className="w-full h-[600px] max-w-md mx-auto">
      <WebAgentChat source={source} />
    </div>
  );
}


