import React, { useEffect, useState } from 'react';
import { EnhancedUpgradeModal } from '../components/EnhancedUpgradeModal';
import NavBar from '../components/NavBar';
import ConversationView from '../features/chat/components/ConversationView';
import { MessageInput } from '../features/chat/components/MessageInput';
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
            {/* Chat Messages */}
            <div className="h-[calc(100vh-300px)] min-h-[400px] overflow-y-auto">
              <ConversationView
                conversation={conversation}
                onDeleteMessage={deleteMessage}
                onCopyMessage={copyMessage}
                onUpdateTitle={updateTitle}
              />
            </div>
          </div>
        </main>

        {/* Message Input */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <MessageInput
            onSendMessage={handleSendMessage}
            onVoiceTranscription={handleSendMessage}
            isProcessing={isProcessing}
            userId={user?.id}
            tier={tier}
            sessionId={conversation?.id}
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
