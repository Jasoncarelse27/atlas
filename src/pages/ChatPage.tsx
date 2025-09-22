import React, { useEffect, useState } from 'react';
import EnhancedUpgradeModal from '../components/EnhancedUpgradeModal';
import NavBar from '../components/NavBar';
import EnhancedInputToolbar from '../components/chat/EnhancedInputToolbar';
import EnhancedMessageBubble from '../components/chat/EnhancedMessageBubble';
import { useChat } from '../features/chat/hooks/useChat';
import MessageStoreDebugger from '../features/debug/MessageStoreDebugger';
import ErrorBoundary from '../lib/errorBoundary';
import { checkSupabaseHealth } from '../lib/supabaseClient';
import type { Tier } from '../types/tier';

interface ChatPageProps {
  user?: any;
}

const ChatPage: React.FC<ChatPageProps> = ({ user }) => {
  const [healthError, setHealthError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Use the new modular useChat hook
  const {
    conversation,
    isProcessing,
    messageCount,
    tier,
    model,
    handleSendMessage,
    handleLogout,
    deleteMessage,
    copyMessage,
    updateTitle,
    upgradeModalVisible,
    setUpgradeModalVisible,
    upgradeReason,
    handleUpgrade
  } = useChat(user?.id);

  // Handle enhanced message sending with typing effect
  const handleEnhancedSendMessage = async (message: string) => {
    await handleSendMessage(message);
    setIsTyping(true);
    
    // Simulate typing effect duration based on message length
    const typingDuration = Math.min(Math.max(message.length * 50, 1000), 3000);
    setTimeout(() => setIsTyping(false), typingDuration);
  };

  // Health check with auto-retry every 30 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;

    async function runHealthCheck() {
      setRetrying(true);
      const result = await checkSupabaseHealth();
      if (!result.ok) {
        setHealthError("Atlas servers are unreachable. Retrying in 30s...");
      } else {
        setHealthError(null);
      }
      setRetrying(false);
    }

    runHealthCheck(); // immediate check
    interval = setInterval(runHealthCheck, 30_000); // retry every 30s

    return () => clearInterval(interval);
  }, []);

  // Show health error fallback if Supabase is unreachable
  if (healthError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center p-6">
        <div className="p-6 bg-yellow-100 text-yellow-800 rounded-xl text-center max-w-md border border-yellow-200">
          <div className="text-lg font-semibold mb-2">Connection Issue</div>
          <div className="mb-4">{healthError}</div>
          {retrying && (
            <div className="flex justify-center">
              <svg
                className="animate-spin h-6 w-6 text-yellow-700"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        {/* Navigation */}
        <NavBar
          user={user}
          tier={tier}
          messageCount={messageCount}
          onLogout={handleLogout}
        />

        {/* Main Chat Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 chat-messages-container">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden">
            {/* Enhanced Chat Messages */}
            <div className="h-[calc(100vh-250px)] min-h-[400px] overflow-y-auto p-6 pb-24">
              <div className="max-w-4xl mx-auto space-y-4">
                {conversation?.messages?.map((message, index) => (
                  <EnhancedMessageBubble
                    key={message.id}
                    message={message}
                    isLatest={index === conversation.messages.length - 1}
                    isTyping={index === conversation.messages.length - 1 && isTyping}
                  />
                ))}
                
                {/* Typing Indicator */}
                {isTyping && !conversation?.messages?.length && (
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B2BDA3] to-[#F4E5D9] flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="flex-1 max-w-3xl">
                      <div className="px-4 py-3 bg-gradient-to-br from-[#B2BDA3]/10 to-[#F4E5D9]/10 border border-[#B2BDA3]/20 rounded-2xl rounded-bl-md">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-[#B2BDA3] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-[#B2BDA3] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-[#B2BDA3] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Enhanced Message Input */}
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 via-gray-900/95 to-transparent pt-8 pb-4">
          <EnhancedInputToolbar
            onSendMessage={handleEnhancedSendMessage}
            onVoiceTranscription={handleEnhancedSendMessage}
            isProcessing={isProcessing}
            placeholder="Ask Atlas anything..."
          />
        </div>

        {/* Development Debugger */}
        <MessageStoreDebugger />

        {/* Upgrade Modal */}
        <EnhancedUpgradeModal
          isOpen={upgradeModalVisible}
          onClose={() => setUpgradeModalVisible(false)}
          currentTier={tier as Tier}
          reason={upgradeReason === 'daily_limit' ? 'daily_limit' : 'audio'}
          onUpgrade={handleUpgrade}
        />
      </div>
    </ErrorBoundary>
  );
};

export default ChatPage;
