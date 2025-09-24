import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import EnhancedUpgradeModal from '../components/EnhancedUpgradeModal';
import { MessageListWithPreviews } from '../components/MessageListWithPreviews';
import EnhancedInputToolbar from '../components/chat/EnhancedInputToolbar';
import EnhancedMessageBubble from '../components/chat/EnhancedMessageBubble';
import { useChat } from '../features/chat/hooks/useChat';
import MessageStoreDebugger from '../features/debug/MessageStoreDebugger';
import ErrorBoundary from '../lib/errorBoundary';
import { checkSupabaseHealth } from '../lib/supabaseClient';
import type { Message } from '../types/chat';
import type { Tier } from '../types/tier';

// Sidebar components
import InsightsWidget from '../components/sidebar/InsightsWidget';
import PrivacyToggle from '../components/sidebar/PrivacyToggle';
import QuickActions from '../components/sidebar/QuickActions';
import UsageCounter from '../components/sidebar/UsageCounter';

interface ChatPageProps {
  user?: any;
}

const ChatPage: React.FC<ChatPageProps> = ({ user }) => {
  const [healthError, setHealthError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Use the new modular useChat hook
  const {
    conversation,
    isProcessing,
    messageCount,
    tier,
    model,
    handleSendMessage,
    handleFileMessage,
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

  // Handle enhanced file message with typing effect
  const handleEnhancedFileMessage = async (message: Message) => {
    await handleFileMessage(message);
    setIsTyping(true);
    
    // Simulate typing effect duration for file processing
    const typingDuration = 2000; // 2 seconds for file processing
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
        {/* Header with Menu Button */}
        <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-white">Atlas AI</h1>
                  <p className="text-gray-400">Your emotionally intelligent AI assistant</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-400">{tier} tier</span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setSidebarOpen(false)}
              />
              
              {/* Sidebar */}
              <motion.div
                initial={{ x: -320 }}
                animate={{ x: 0 }}
                exit={{ x: -320 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed left-0 top-0 h-full w-80 bg-[#1e1f24] border-r border-gray-800 z-50 overflow-y-auto"
              >
                <div className="p-4 space-y-6">
                  {/* Close Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Sidebar Content */}
                  <QuickActions />
                  <UsageCounter />
                  <InsightsWidget />
                  <PrivacyToggle />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Chat Container */}
        <div className="flex flex-col h-[calc(100vh-80px)]">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-4xl mx-auto space-y-4">
              <MessageListWithPreviews>
                {conversation?.messages?.map((message, index) => (
                  <EnhancedMessageBubble
                    key={message.id}
                    message={message}
                    isLatest={index === conversation.messages.length - 1}
                    isTyping={index === conversation.messages.length - 1 && isTyping}
                    onRetry={() => handleRetry(message.id)}
                  />
                ))}
              </MessageListWithPreviews>
              
              {/* Typing Indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start space-x-3"
                >
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
                </motion.div>
              )}
            </div>
          </div>

          {/* Input Toolbar */}
          <div className="bg-gray-800/50 backdrop-blur-sm border-t border-gray-700/50 p-4">
            <div className="max-w-4xl mx-auto">
              <EnhancedInputToolbar
                onSendMessage={handleEnhancedSendMessage}
                onVoiceTranscription={handleEnhancedSendMessage}
                onFileMessage={handleEnhancedFileMessage}
                isProcessing={isProcessing}
                placeholder="Ask Atlas anything..."
              />
            </div>
          </div>
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
