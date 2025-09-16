import React from 'react';
import { ChatHeader } from '../features/chat/components/ChatHeader';
import ConversationView from '../features/chat/components/ConversationView';
import { MessageInput } from '../features/chat/components/MessageInput';
import { useChat } from '../features/chat/hooks/useChat';
import ErrorBoundary from '../lib/errorBoundary';
import MessageStoreDebugger from '../features/debug/MessageStoreDebugger';

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
    updateTitle
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
              isProcessing={isProcessing}
            />
          </div>
        </main>

        {/* Development Debugger */}
        <MessageStoreDebugger />
      </div>
    </ErrorBoundary>
  );
};

export default ChatPage;
