import React from 'react';
import { EnhancedUpgradeModal } from '../components/EnhancedUpgradeModal';
import { ChatHeader } from '../features/chat/components/ChatHeader';
import ConversationView from '../features/chat/components/ConversationView';
import { MessageInput } from '../features/chat/components/MessageInput';
import { useChat } from '../features/chat/hooks/useChat';
import MessageStoreDebugger from '../features/debug/MessageStoreDebugger';
import ErrorBoundary from '../lib/errorBoundary';
import type { Tier } from '../types/tier';

interface ChatPageProps {
  user?: any;
}

const ChatPage: React.FC<ChatPageProps> = ({ user }) => {
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

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        {/* Header */}
        <ChatHeader
          user={user}
          tier={tier}
          messageCount={messageCount}
          onLogout={handleLogout}
        />

        {/* Main Chat Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            
            {/* Message Input */}
            <MessageInput
              onSendMessage={handleSendMessage}
              onVoiceTranscription={handleSendMessage}
              isProcessing={isProcessing}
              userId={user?.id}
              tier={tier}
              sessionId={conversation?.id}
            />
          </div>
        </main>

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
