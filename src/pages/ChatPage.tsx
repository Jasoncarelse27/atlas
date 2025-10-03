import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import EnhancedUpgradeModal from '../components/EnhancedUpgradeModal';
import { MessageListWithPreviews } from '../components/MessageListWithPreviews';
import { ScrollToBottomButton } from '../components/ScrollToBottomButton';
import SyncStatus from '../components/SyncStatus';
import EnhancedInputToolbar from '../components/chat/EnhancedInputToolbar';
import EnhancedMessageBubble from '../components/chat/EnhancedMessageBubble';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useMemoryIntegration } from '../hooks/useMemoryIntegration';
import { usePersistentMessages } from '../hooks/usePersistentMessages';
import ErrorBoundary from '../lib/errorBoundary';
import { checkSupabaseHealth, supabase } from '../lib/supabaseClient';
import { chatService } from '../services/chatService';
import { runDbMigrations } from '../services/dbMigrations';
import { useMessageStore } from '../stores/useMessageStore';
import type { Message } from '../types/chat';

// Sidebar components
import InsightsWidget from '../components/sidebar/InsightsWidget';
import PrivacyToggle from '../components/sidebar/PrivacyToggle';
import QuickActions from '../components/sidebar/QuickActions';
import UsageCounter from '../components/sidebar/UsageCounter';

interface ChatPageProps {
  user?: any;
}

const ChatPage: React.FC<ChatPageProps> = () => {
  const [healthError, setHealthError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hasStreamingResponse, setHasStreamingResponse] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { initConversation, hydrateFromOffline } = useMessageStore();

  // Memory integration
  const { processUserMessage } = useMemoryIntegration({ userId: userId || undefined });

  // Use persistent messages with offline sync
  const {
    messages,
    addMessage,
    updateMessage,
  } = usePersistentMessages({
    conversationId: conversationId || '',
    userId: userId || '',
    autoSync: true,
    autoResend: true,
  });

  // Messages container ref for scroll detection
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Modern scroll system with golden sparkle
  const { bottomRef, scrollToBottom, showScrollButton, shouldGlow } = useAutoScroll([messages || []], messagesContainerRef);

  // Ensure scroll to bottom on page refresh/initial load
  useEffect(() => {
    if (messages && messages.length > 0) {
      // Additional scroll to bottom on initial load to ensure it works
      setTimeout(() => {
        scrollToBottom();
      }, 200);
    }
  }, []); // Run once on mount

  // Simple logout function
  const handleLogout = async () => {
    try {
      const { supabase } = await import('../lib/supabase');
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Placeholder variables for components that need them
  const isProcessing = isTyping;
  const upgradeModalVisible = false;
  const setUpgradeModalVisible = (visible: boolean) => {
    console.log('Upgrade modal visibility:', visible);
  };
  const upgradeReason = 'audio';

  // Handle text messages - delegate to chatService
  const handleTextMessage = async (text: string) => {
      setIsTyping(true);
      setHasStreamingResponse(false);
    
    try {
      // Process message for memory extraction FIRST and wait for completion
      await processUserMessage(text);
      
      // Minimum delay to show loading dots (800ms for optimal UX)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Create message for persistent store
      const message: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        type: 'text',
        content: text,
        timestamp: new Date().toISOString(),
        status: 'sending',
      };

      // Add to persistent store
      await addMessage(message);

      // Use chatService as the single source of truth
      const assistantResponse = await chatService.sendMessage(text, () => {
        // Update message status to sent
        updateMessage(message.id, { status: 'sent' });
      }, conversationId || undefined);
      
      // Once response starts coming in, mark as streaming and clear typing
      setHasStreamingResponse(true);
      setIsTyping(false);

      // ✅ Create assistant message immediately with loading state
      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        type: 'text',
        content: '', // Start empty
        timestamp: new Date().toISOString(),
        status: 'sending', // Show as loading
      };

      console.log("🔍 [ChatPage] Creating loading message:", assistantMessage);
      // Add loading message immediately
      await addMessage(assistantMessage);

      // Update with actual response when ready
      if (assistantResponse) {
        console.log("🔍 [ChatPage] Updating message with response:", assistantResponse);
        updateMessage(assistantMessageId, { 
          content: assistantResponse,
          status: 'sent'
        });
      }
    } catch (error) {
      console.error('Text message handling error:', error);
      setIsTyping(false);
    }
  };

  // Get authenticated user
  useEffect(() => {
    const getAuthUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getAuthUser();
  }, []);

  // Initialize conversation and run migrations
  useEffect(() => {
    if (!userId) return;
    
    const initializeApp = async () => {
      try {
        // Run database migrations first
        await runDbMigrations(userId);
        
        // ✅ Check if conversation ID is in URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlConversationId = urlParams.get('conversation');
        
        let id: string;
        if (urlConversationId) {
          // Load existing conversation from URL
          id = urlConversationId;
          
          // ✅ Hydrate messages from Supabase
          await hydrateFromOffline(id);
        } else {
          // Create new conversation
          id = await initConversation(userId);
        }
        
        setConversationId(id);
      } catch (error) {
        console.error("[ChatPage] ❌ Failed to initialize app:", error);
      }
    };

    initializeApp();
  }, [userId, initConversation, hydrateFromOffline]);

  // Health check with auto-retry every 30 seconds
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

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
                {conversationId && (
                  <SyncStatus conversationId={conversationId} userId={userId ?? ''} className="hidden md:flex" />
                )}
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
                  <UsageCounter userId={userId ?? ''} />
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
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-4xl mx-auto space-y-4">
              
              <MessageListWithPreviews>
                {(() => {
                  const safeMessages = messages || [];
                  if (safeMessages.length > 0) {
                    return safeMessages.map((message: Message, index: number) => (
                      <EnhancedMessageBubble
                        key={message.id}
                        message={message}
                        isLatest={index === safeMessages.length - 1}
                        isTyping={index === safeMessages.length - 1 && isTyping && hasStreamingResponse}
                      />
                    ));
                  } else {
                    return (
                      <div className="space-y-4">
                        <div className="flex justify-center items-center h-32">
                          <div className="text-center text-gray-400">
                            <div className="mb-4">
                              <img 
                                src="/atlas-logo.png" 
                                alt="Atlas AI" 
                                className="w-16 h-16 mx-auto object-contain"
                              />
                            </div>
                            <h2 className="text-xl font-semibold mb-2">Welcome to Atlas AI</h2>
                            <p className="text-sm">Your emotionally intelligent AI assistant is ready to help.</p>
                            <p className="text-xs mt-2 text-gray-500">Start a conversation below!</p>
                          </div>
                        </div>
                        
                      </div>
                    );
                  }
                })()}
              </MessageListWithPreviews>
              
              
              {/* Scroll anchor */}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input Toolbar */}
          <div className="bg-gray-800/50 backdrop-blur-sm border-t border-gray-700/50 p-4">
            <div className="max-w-4xl mx-auto">
              <EnhancedInputToolbar
                onSendMessage={handleTextMessage}
                isProcessing={isProcessing}
                placeholder="Ask Atlas anything..."
                conversationId={conversationId || undefined}
              />
            </div>
          </div>
        </div>

        {/* Modern scroll-to-bottom button with golden sparkle */}
        <ScrollToBottomButton
          onClick={scrollToBottom}
          visible={showScrollButton}
          shouldGlow={shouldGlow}
        />

        {/* Upgrade Modal */}
        <EnhancedUpgradeModal
          isOpen={upgradeModalVisible}
          onClose={() => setUpgradeModalVisible(false)}
          feature={upgradeReason}
        />
      </div>
    </ErrorBoundary>
  );
};

export default ChatPage;