import { useState } from 'react';
import ErrorMessage from '../../../components/ErrorMessage';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';
import useChatLogic from '../hooks/useChatLogic';
import AssistantResponse from './AssistantResponse';
import ChatInput from './ChatInput';
import InsightsDashboard from './InsightsDashboard';
import MessageList from './MessageList';
import QuickStartSuggestions from './QuickStartSuggestions';
import TierGate from './TierGate';
type Subscription = any;

interface ChatScreenProps {
  userId: string;
  subscription?: Subscription | null;
  onUpgrade?: () => void;
}

export default function ChatScreen({ userId, subscription, onUpgrade }: ChatScreenProps) {
  const { user, tier } = useSupabaseAuth();
  const [showInsights, setShowInsights] = useState(false);
  const {
    messages,
    currentConversationId,
    inputText,
    isLoading,
    error,
    limitExceeded,
    showErrorToast,
    showSuggestions,
    selectedModel,
    setInputText,
    setShowErrorToast,
    setSelectedModel,
    sendMessage,
    retryMessage,
    handleSuggestionClick,
    handleVoiceTranscription
  } = useChatLogic({ userId: user?.id || userId, userTier: (tier as any) || 'free' });

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
    <TierGate subscription={subscription as any} messageCount={messages.length} maxFreeMessages={10} onUpgrade={onUpgrade}>
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
                onRetry={!limitExceeded ? () => { setShowErrorToast(false); sendMessage(inputText); } : undefined}
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
            <>
              <MessageList messages={messages} onRetryMessage={retryMessage as any} />
              <AssistantResponse isLoading={isLoading} />
            </>
          )}
        </div>

        <ChatInput
          value={inputText}
          onChange={setInputText}
          onSend={() => sendMessage(inputText)}
          onVoiceTranscription={handleVoiceTranscription}
          disabled={isLoading}
        />

        {/* Insights Dashboard */}
        <InsightsDashboard
          insights={mockInsights}
          isVisible={showInsights}
          onClose={() => setShowInsights(false)}
        />
      </div>
    </TierGate>
  );
}
