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
import type { Message } from '../types/chat';
// Removed usePersistentMessages import - using direct message management instead
import CacheMonitoringDashboard from '../components/CacheMonitoringDashboard';
import { atlasDB } from '../database/atlasDB';
import { useSubscription } from '../hooks/useSubscription';
import ErrorBoundary from '../lib/errorBoundary';
import { checkSupabaseHealth, supabase } from '../lib/supabaseClient';
import { chatService } from '../services/chatService';
import { databaseMigration } from '../services/databaseMigration';
import { messageRegistry } from '../services/messageRegistry';
import { startBackgroundSync, stopBackgroundSync } from '../services/syncService';
// Removed useMessageStore import - using usePersistentMessages as single source of truth
import { generateUUID } from '../utils/uuid';

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
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  // Removed duplicate useMessageStore - using usePersistentMessages as single source of truth
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Memory integration
  useMemoryIntegration({ userId: userId || undefined });

  // Subscription management
  useSubscription(userId || undefined);

  // 🧭 ARCHITECTURE: Dexie remains single source of truth
  const [messages, setMessages] = useState<Message[]>([]);
  
  // ✅ BULLETPROOF: Check for duplicates before adding to UI
  const addMessageToUI = (newMessage: Message) => {
    // Check for duplicates using lightweight middleware
    const isNotDuplicate = messageRegistry.trackMessage(newMessage);
    if (!isNotDuplicate) {
      console.warn('[ChatPage] ⚠️ Duplicate message prevented:', newMessage.id);
      return;
    }
    
    // Add to React state (Dexie handles persistence)
    setMessages(prev => [...prev, newMessage]);
  };
  
  // Message persistence utility - converts Message to Dexie format (schema-compliant)
  const messageToDexie = (message: Message, targetConversationId?: string) => ({
    id: message.id,
    conversationId: targetConversationId || conversationId || 'default',
    userId: userId || 'anonymous',
    role: message.role,
    type: message.type === 'text' || message.type === 'image' || message.type === 'audio' ? message.type : 'text',
    content: message.content || '',
    timestamp: message.timestamp,
    synced: false,
    updatedAt: new Date().toISOString()
    // ✅ REMOVED: attachments, metadata, url, imageUrl, audioUrl (not in Dexie schema)
  });

  // 🧭 ARCHITECTURE: Add message with Dexie persistence + deduplication check
  const addMessage = async (message: Message) => {
    // Check for duplicates using lightweight middleware
    const isNotDuplicate = messageRegistry.trackMessage(message);
    if (!isNotDuplicate) {
      console.warn('[ChatPage] ⚠️ Duplicate message prevented:', message.id);
      return;
    }
    
    // Add to UI state
    setMessages(prev => [...prev, message]);
    
    // ✅ CRITICAL: Ensure we have a valid conversationId (should always be set now)
    if (!conversationId) {
      console.error('[ChatPage] ❌ CRITICAL: addMessage called without conversationId!');
      // Create emergency conversationId if somehow missing
      const emergencyId = generateUUID();
      setConversationId(emergencyId);
      localStorage.setItem('atlas:lastConversationId', emergencyId);
      
      // Save with emergency ID
      try {
        await atlasDB.messages.put(messageToDexie(message, emergencyId));
        console.log('[ChatPage] ✅ Message saved with emergency conversationId:', emergencyId);
      } catch (error) {
        console.error('[ChatPage] ❌ Failed to save message to Dexie:', error);
      }
      return;
    }
    
    // Save to Dexie immediately with the proper conversationId
    try {
      const dexieMessage = messageToDexie(message, conversationId);
      await atlasDB.messages.put(dexieMessage);
    } catch (error) {
      console.error('[ChatPage] Failed to save message:', error);
    }
  };
  
  // updateMessage function removed - backend handles all message creation and updates
  
  // 🧭 ARCHITECTURE: Load messages from Dexie (single source of truth)
  const loadMessages = async (conversationId: string) => {
    try {
      const storedMessages = await atlasDB.messages
        .where("conversationId")
        .equals(conversationId)
        .sortBy("timestamp");
      
      const formattedMessages = storedMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        type: msg.type || 'text'
      } as Message));
      
      // Track messages for deduplication (lightweight)
      messageRegistry.trackMessages(formattedMessages);
      
      // Set React state (Dexie is authoritative)
      setMessages(formattedMessages);
      console.log('[ChatPage] ✅ Loaded', formattedMessages.length, 'messages from Dexie');
    } catch (error) {
      console.error('[ChatPage] Failed to load messages:', error);
      setMessages([]);
    }
  };

  // Messages container ref for scroll detection
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Modern scroll system with golden sparkle
  const { bottomRef, scrollToBottom, showScrollButton, shouldGlow } = useAutoScroll([messages || []], messagesContainerRef);
  
  // Auto-scroll when messages change
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [messages]);

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
      // Silent fail - logout will redirect regardless
    }
  };

  // Upgrade modal state
  const [upgradeModalVisible, setUpgradeModalVisible] = React.useState(false);
  const [upgradeReason, setUpgradeReason] = React.useState('monthly limit');
  const [currentUsage, setCurrentUsage] = React.useState<number | undefined>();
  const [limit, setLimit] = React.useState<number | undefined>();

  // Placeholder variables for components that need them
  const isProcessing = isTyping;

  // Guard to prevent duplicate calls using ref (immediate, no state update delay)
  const isProcessingRef = useRef(false);
  const lastMessageRef = useRef<string>('');
  
  // ✅ BULLETPROOF: Clean message handling like ChatGPT
  const handleTextMessage = async (text: string) => {
    // Prevent duplicate calls
    if (isProcessingRef.current) {
      return;
    }
    
    // Prevent duplicate content
    if (lastMessageRef.current === text.trim()) {
      return;
    }
    
    lastMessageRef.current = text.trim();
    isProcessingRef.current = true;
    
    try {
      // ✅ STEP 1: Show user message immediately (like ChatGPT)
      const userMessage: Message = {
        id: generateUUID(),
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        type: 'text'
      };
      
      // Add user message to UI instantly with bulletproof duplicate prevention
      addMessageToUI(userMessage);
      
      // ✅ STEP 2: Show Atlas typing indicator
      setIsTyping(true);
      setIsStreaming(true);
      console.log('[ChatPage] 🎯 Starting Atlas typing indicator');

      // ✅ STEP 3: Send to backend (backend creates its own user + assistant messages)
      await chatService.sendMessage(
        text, 
        () => {}, // No frontend status updates needed
        conversationId || undefined, 
        userId || undefined
      );
      
      // ✅ SIMPLE: Just sync backend data without complex merging (real-time listener handles new messages)
      setTimeout(async () => {
        try {
          const { conversationSyncService } = await import('../services/conversationSyncService');
          if (userId) {
            // Get fresh messages from backend
            await conversationSyncService.deltaSync(userId);
            
            // ✅ SIMPLE: Only turn off typing indicator, don't mess with messages
            // The real-time listener will handle new assistant messages
            setIsStreaming(false);
            console.log('[ChatPage] 🎯 Stopping Atlas typing indicator - sync complete');
          }
        } catch (error) {
          console.error('[ChatPage] Sync failed:', error);
          setIsStreaming(false);
        }
      }, 500); // Reduced timeout for faster response
      
    } catch (error) {
      setIsTyping(false);
      setIsStreaming(false);
      
      if (error instanceof Error && error.message === 'MONTHLY_LIMIT_REACHED') {
        setCurrentUsage(15);
        setLimit(15);
        setUpgradeReason('monthly message limit');
        setUpgradeModalVisible(true);
        return;
      }
    } finally {
      isProcessingRef.current = false;
      setIsTyping(false);
      // DON'T reset streaming here - let sync handle it
      
      setTimeout(() => {
        lastMessageRef.current = '';
      }, 1000);
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

  // 💎 PREMIUM: Real-time message listener through registry
  useEffect(() => {
    if (!userId || !conversationId) return;

    console.log('[ChatPage] 🔔 Setting up real-time listener for conversation:', conversationId);

    // Listen for new messages in real-time
    const subscription = supabase
      .channel(`conversation_${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const newMsg = payload.new;
        
        console.log('[ChatPage] 🔔 Real-time message received:', {
          id: newMsg.id,
          role: newMsg.role,
          contentPreview: newMsg.content?.slice(0, 50)
        });
        
        // If Atlas just started responding, immediately hide thinking dots
        if (newMsg.role === 'assistant' && newMsg.content && newMsg.content !== '...') {
          console.log('[ChatPage] 🎯 Atlas started responding - hiding thinking dots immediately');
          setIsStreaming(false);
          setIsTyping(false);
        }
        
        // ✅ SMART: Only add assistant messages, ignore user messages (we add them optimistically)
        if (newMsg.role === 'assistant') {
          const message: Message = {
            id: newMsg.id,
            role: newMsg.role,
            content: newMsg.content,
            timestamp: newMsg.created_at,
            type: 'text'
          };
          
          // Check for duplicates using lightweight middleware
          const isNotDuplicate = messageRegistry.trackMessage(message);
          if (isNotDuplicate) {
            setMessages(prev => [...prev, message]);
            console.log('[ChatPage] ✅ Real-time message added to UI');
          } else {
            console.log('[ChatPage] ⚠️ Real-time message was duplicate, skipped');
          }
        }
      })
      .subscribe();

    return () => {
      console.log('[ChatPage] 🔕 Cleaning up real-time listener');
      supabase.removeChannel(subscription);
    };
  }, [userId, conversationId]);

  // 💎 PREMIUM: Initialize conversation with registry cleanup
  useEffect(() => {
    if (!userId) return;
    
    const initializeConversation = async () => {
      try {
        // ✅ PRIORITY 1: Set conversation ID FIRST (before any other operations)
        const urlParams = new URLSearchParams(window.location.search);
        const urlConversationId = urlParams.get('conversation');
        const lastConversationId = localStorage.getItem('atlas:lastConversationId');
        
        let id: string;
        if (urlConversationId) {
          // Load existing conversation from URL
          id = urlConversationId;
        } else if (lastConversationId) {
          // Auto-restore last conversation
          id = lastConversationId;
        } else {
          // Create new conversation
          id = generateUUID();
        }
        
        // ✅ CRITICAL: Clear deduplication tracking when switching conversations
        console.log('[ChatPage] 🔄 Switching to conversation:', id);
        messageRegistry.clearTracking();
        
        // ✅ CRITICAL: Set conversation ID IMMEDIATELY before any messages can be sent
        localStorage.setItem('atlas:lastConversationId', id);
        setConversationId(id);
        
        // ✅ Update URL if it's missing the conversation ID
        if (!urlConversationId && id) {
          const newUrl = `/chat?conversation=${id}`;
          window.history.replaceState({}, '', newUrl);
        }
        
        // Load existing messages immediately (through registry)
        await loadMessages(id);
        
        // Sync to get latest messages from backend (only once, don't reload after)
        try {
          const { conversationSyncService } = await import('../services/conversationSyncService');
          await conversationSyncService.deltaSync(userId);
          // DON'T call loadMessages again - real-time listener will handle new messages
          console.log('[ChatPage] ✅ Initial sync complete, real-time listener active');
        } catch (error) {
          console.error('[ChatPage] Initial sync failed:', error);
        }
        
      } catch (error) {
        console.error('[ChatPage] Failed to initialize conversation:', error);
      }
    };

    initializeConversation();
  }, [userId]);

  // Run migrations separately (only once per session)
  useEffect(() => {
    if (!userId) return;
    
    const migrationKey = `migration-run-${userId}`;
    if (sessionStorage.getItem(migrationKey)) {
      return; // Already ran migrations this session
    }
    
    const runMigrations = async () => {
      try {
        await databaseMigration.migrateDatabase();
        sessionStorage.setItem(migrationKey, 'true');
      } catch (error) {
        console.error('[ChatPage] Migration error:', error);
        try {
          await databaseMigration.clearAllData();
        } catch (clearError) {
          console.error('[ChatPage] Failed to clear data:', clearError);
        }
      }
    };

    runMigrations();
  }, [userId]);

  // Start background sync (separate from critical initialization)
  useEffect(() => {
    if (!userId) return;
    
    const initializeBackgroundSync = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const accessToken = session?.access_token;
            
            if (accessToken) {
              const response = await fetch(`/v1/user_profiles/${user.id}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                  'Content-Type': 'application/json',
                },
              });
              
              if (response.ok) {
                const profile = await response.json();
                const tier = profile?.subscription_tier || 'core';
                startBackgroundSync(user.id, tier);
              } else {
                startBackgroundSync(user.id, 'core');
              }
            } else {
              startBackgroundSync(user.id, 'core');
            }
          } catch (error) {
            startBackgroundSync(user.id, 'core');
          }
        }
      } catch (error) {
        console.error('[ChatPage] Background sync initialization error:', error);
      }
    };

    initializeBackgroundSync();
  }, [userId]);

  // Cleanup background sync on unmount
  useEffect(() => {
    return () => {
      stopBackgroundSync();
    };
  }, []);
  

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
        <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-30">
          <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white">Atlas AI</h1>
                  <p className="text-gray-400 text-sm sm:text-base hidden sm:block">Your emotionally intelligent AI assistant</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <SyncStatus isOnline={true} />
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm sm:text-base"
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
        <div 
          className="flex flex-col h-[calc(100vh-120px)] sm:h-[calc(100vh-80px)]"
          onClick={(e) => {
            // 📱 ChatGPT-like behavior: dismiss keyboard when clicking outside input
            const target = e.target as HTMLElement;
            const isInputArea = target.closest('[data-input-area]');
            
            if (!isInputArea && inputRef.current) {
              inputRef.current.blur();
            } else if (inputRef.current) {
              inputRef.current.focus();
            }
          }}
        >

          {/* Messages */}
          <div 
            ref={messagesContainerRef} 
            className="flex-1 overflow-y-auto px-4 py-6 pt-4 pb-4"
            onScroll={() => {
              // 📱 Dismiss keyboard when scrolling (ChatGPT-like behavior)
              if (inputRef.current) {
                inputRef.current.blur();
              }
            }}
          >
            <div className="max-w-4xl mx-auto space-y-4">
              
              <MessageListWithPreviews>
                {(() => {
                  const safeMessages = messages || [];
                  if (safeMessages.length > 0) {
                    return (
                      <>
                        {safeMessages.map((message: Message, index: number) => (
                          <EnhancedMessageBubble
                            key={message.id}
                            message={message}
                            isLatest={index === safeMessages.length - 1}
                            isTyping={false}
                          />
                        ))}
                        
        {/* ✅ PREMIUM: Clean typing dots with smooth animations */}
        {(() => {
          if (isStreaming) {
            console.log('[ChatPage] 🎯 Rendering typing indicator, isStreaming:', isStreaming);
            return true;
          }
          return false;
        })() && (
          <motion.div 
            key="atlas-typing" 
            className="flex justify-start mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                <div className="w-4 h-4 bg-white rounded-full"></div>
              </div>
              {/* ✅ PREMIUM: Smooth, elegant thinking dots */}
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0ms', animationDuration: '1.4s'}}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '200ms', animationDuration: '1.4s'}}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '400ms', animationDuration: '1.4s'}}></div>
              </div>
            </div>
          </motion.div>
        )}
                        
                      </>
                    );
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

          {/* Input Toolbar with Bounce Animation - Floating Design */}
          <motion.div 
            className="bg-transparent backdrop-blur-2xl p-0 sm:p-4 sticky bottom-0 z-30"
            initial={{ y: 0 }}
            animate={{ y: 0 }}
            whileHover={{ 
              y: -1,
              transition: { 
                type: "spring", 
                stiffness: 300, 
                damping: 25 
              }
            }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 30 
            }}
          >
            <div className="max-w-4xl mx-auto">
              <EnhancedInputToolbar
                onSendMessage={handleTextMessage}
                isProcessing={isProcessing}
                placeholder="Ask Atlas anything..."
                conversationId={conversationId || undefined}
                inputRef={inputRef}
                addMessage={addMessage}
                isStreaming={isStreaming}
              />
            </div>
          </motion.div>
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
          currentUsage={currentUsage}
          limit={limit}
        />

        {/* Cache Monitoring Dashboard */}
        <CacheMonitoringDashboard />
        
      </div>
    </ErrorBoundary>
  );
};

export default ChatPage;