import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ErrorMessage from '../../../components/ErrorMessage';
import TypingIndicator from '../../../components/TypingIndicator';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';
import { appendMessage as cacheAppend, loadConversation as cacheLoad, toCachedMessage } from '../../../lib/conversationStore';
import type { Message } from '../../types/chat';
import type { Subscription } from '../../types/subscription';
import messageService from '../services/messageService';
import InsightsDashboard from './InsightsDashboard';
import MessageRenderer from './MessageRenderer';
import QuickStartSuggestions from './QuickStartSuggestions';
import SubscriptionGate from './SubscriptionGate';
import VoiceInput from './VoiceInput';

interface ChatScreenProps {
  userId: string;
  subscription?: Subscription | null;
  onUpgrade?: () => void;
}

export default function ChatScreen({ userId, subscription, onUpgrade }: ChatScreenProps) {
  const { user, accessToken, tier } = useSupabaseAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitExceeded, setLimitExceeded] = useState<boolean>(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showInsights, setShowInsights] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'claude' | 'groq' | 'opus'>('claude');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Hydrate cached conversation on first ID set
  useEffect(() => {
    if (currentConversationId) {
      (async () => {
        const cached = await cacheLoad(currentConversationId);
        if (cached && (cached as any).messages?.length) {
          setMessages((cached as any).messages as Message[]);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId]);

  // After reconnect/resume, fetch incremental messages since latest cached
  useEffect(() => {
    let timer: any;
    const fetchIncrements = async () => {
      if (!currentConversationId) return;
      const cached = await cacheLoad(currentConversationId);
      const latestTs = cached && (cached as any).messages?.length
        ? Date.parse((cached as any).messages[(cached as any).messages.length - 1].timestamp)
        : 0;
      if (!latestTs) return;
      try {
        const newMsgs = await messageService.getConversationMessagesSince(currentConversationId, latestTs);
        if (newMsgs && newMsgs.length) {
          // Merge into Dexie and UI
          for (const m of newMsgs) {
            await cacheAppend(currentConversationId, {
              id: m.id,
              conversation_id: currentConversationId,
              role: m.role,
              content: m.content as any,
              timestamp: m.timestamp,
              status: 'sent'
            } as any);
          }
          const hydrated = await cacheLoad(currentConversationId);
          if (hydrated && (hydrated as any).messages) {
            setMessages((hydrated as any).messages as Message[]);
          }
        }
      } catch (e) {
        // ignore fetch errors
      }
    };
    // Poll occasionally or you could hook into visibilitychange/network events
    timer = setInterval(fetchIncrements, 5000);
    return () => clearInterval(timer);
  }, [currentConversationId]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setShowSuggestions(false);
    
    // Create optimistic user message
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: {
        type: 'text',
        text: text.trim()
      },
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    
    try {
      // Streaming path
      let assistantId = uuidv4();
      let runningText = '';
      const tempAssistant: Message = {
        id: assistantId,
        role: 'assistant',
        content: { type: 'text', text: '' },
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, tempAssistant]);

      const response = await messageService.sendMessageStream({
        message: text.trim(),
        conversationId: currentConversationId || undefined,
        model: selectedModel,
        userTier: (tier as any) || 'free',
        userId: user?.id || userId
      }, (chunk) => {
        runningText += chunk;
        setMessages(prev => prev.map(m => m.id === assistantId ? ({ ...m, content: { type: 'text', text: runningText } }) : m));
      });
      
      // Update conversation ID if this is a new conversation
      if (!currentConversationId) {
        setCurrentConversationId(response.conversationId);
      }
      
      // Replace the assistant temp with stored response
      setMessages(prev => prev.map(m => m.id === assistantId ? response.response : m));
      // cache both user and assistant messages
      const convoId = response.conversationId;
      cacheAppend(convoId, toCachedMessage(userMessage));
      cacheAppend(convoId, toCachedMessage(response.response));
      
    } catch (err) {
      // Add error to the optimistic message
      // remove temp assistant bubble on failure
      setMessages(prev => prev.filter(m => m.id !== userMessage.id && (!m.content || (m.content as any).text !== '')));
      const messageError = err instanceof Error ? err.message : 'Failed to send message';
      setError(messageError);
      setLimitExceeded(messageError.toLowerCase().includes('daily limit'));
      setShowErrorToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => {
    sendMessage(inputText);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceTranscription = (transcription: string) => {
    setInputText(transcription);
    sendMessage(transcription);
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const handleRetryMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && message.content.type === 'text' && message.content.text) {
      sendMessage(message.content.text);
    }
  };

  const mockInsights = {
    totalMessages: messages.length,
    totalConversations: currentConversationId ? 1 : 0,
    averageResponseTime: 2.5,
    mostActiveDay: 'Monday',
    mostUsedModel: selectedModel,
    totalTokens: messages.length * 150,
    conversationsThisWeek: 1,
    messagesThisWeek: messages.length
  };

  return (
    <SubscriptionGate
      subscription={subscription}
      messageCount={messages.length}
      maxFreeMessages={10}
      onUpgrade={onUpgrade}
    >
      <div className="flex flex-col h-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Atlas AI Chat</h1>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as 'claude' | 'groq' | 'opus')}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            >
              <option value="claude">Claude</option>
              <option value="groq">Groq</option>
              <option value="opus">Opus</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInsights(true)}
              className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {showErrorToast && error && (
            <div className="mb-4">
              <ErrorMessage
                title={limitExceeded ? 'Daily limit reached' : 'Error'}
                message={error}
                type={limitExceeded ? 'warning' : 'error'}
                dismissible
                onDismiss={() => setShowErrorToast(false)}
                onRetry={!limitExceeded ? () => { setShowErrorToast(false); handleSendMessage(inputText); } : undefined}
                retryText="Retry"
              />
            </div>
          )}
          {limitExceeded && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 flex items-center justify-between">
              <span>Daily limit reached on Free tier. Upgrade to continue.</span>
              {onUpgrade && (
                <button onClick={onUpgrade} className="ml-3 px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700">Upgrade</button>
              )}
            </div>
          )}
          {messages.length === 0 && showSuggestions ? (
            <QuickStartSuggestions
              onSuggestionClick={handleSuggestionClick}
              isVisible={showSuggestions}
            />
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <MessageRenderer
                  key={message.id}
                  message={message}
                  isLastMessage={index === messages.length - 1}
                  onRetry={() => handleRetryMessage(message.id)}
                />
              ))}
              
              {isLoading && (
                <TypingIndicator isVisible message="Atlas is thinking..." />
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-3">
            <div className="flex-1">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                disabled={isLoading}
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !inputText.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Sending...' : 'Send'}
              </button>
              
              <VoiceInput
                onTranscriptionComplete={handleVoiceTranscription}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Insights Dashboard */}
        <InsightsDashboard
          insights={mockInsights}
          isVisible={showInsights}
          onClose={() => setShowInsights(false)}
        />
      </div>
    </SubscriptionGate>
  );
}
