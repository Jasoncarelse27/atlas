import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { atlasDB, ensureDatabaseReady } from '../database/atlasDB';
import { useSubscription } from '../hooks/useSubscription';
import ErrorBoundary from '../lib/errorBoundary';
import { logger } from '../lib/logger';
import { checkSupabaseHealth, supabase } from '../lib/supabaseClient';
import { chatService } from '../services/chatService';
import { databaseMigration } from '../services/databaseMigration';
import { startBackgroundSync, stopBackgroundSync } from '../services/syncService';
import { autoGenerateTitle } from '../services/titleGenerationService';
// ✅ PHASE 2: Removed messageRegistry import - no longer needed with single write path
import { generateUUID } from '../utils/uuid';

// Sidebar components
import { ConversationHistoryDrawer } from '../components/ConversationHistoryDrawer';
import InsightsWidget from '../components/sidebar/InsightsWidget';
import PrivacyToggle from '../components/sidebar/PrivacyToggle';
import QuickActions from '../components/sidebar/QuickActions';
import UsageCounter from '../components/sidebar/UsageCounter';
import { useRealtimeConversations } from '../hooks/useRealtimeConversations';

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
  
  // History modal state
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<{
    conversations: any[];
    onDeleteConversation: (id: string) => void;
    deletingId: string | null;
  } | null>(null);
  // Removed duplicate useMessageStore - using usePersistentMessages as single source of truth
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Memory integration
  useMemoryIntegration({ userId: userId || undefined });

  // Subscription management
  const { tier } = useSubscription(userId || undefined);

  // ✅ ENTERPRISE: Real-time conversation deletion listener (clean, reliable)
  useRealtimeConversations(userId || undefined);

  // Handle history modal from QuickActions
  const handleViewHistory = (data: {
    conversations: any[];
    onDeleteConversation: (id: string) => void;
    deletingId: string | null;
  }) => {
    setHistoryData(data);
    setShowHistory(true);
  };

  // ✅ PHASE 2: Messages state - only updated by loadMessages (from Dexie)
  const [messages, setMessages] = useState<Message[]>([]);
  
  // ✅ Add message function for image uploads
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);
  
  // ✅ PHASE 2: Load messages from Dexie (read-only, single source of truth)
  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      // ✅ MOBILE FIX: Ensure userId is available before loading messages
      if (!userId) {
        console.log('[ChatPage] ⚠️ userId not available yet, skipping message load');
        return;
      }
      
      // ✅ MOBILE FIX: Ensure database is ready before use
      await ensureDatabaseReady();
      
      // ✅ MOBILE FIX: Try with userId filter first, fallback without filter if no results
      let storedMessages = await atlasDB.messages
        .where("conversationId")
        .equals(conversationId)
        .and(msg => msg.userId === userId) // ✅ MOBILE FIX: Filter by userId to prevent cross-user data
        .sortBy("timestamp");
      
      // ✅ FALLBACK: If no messages found with userId filter, try without filter (for existing data)
      if (storedMessages.length === 0) {
        console.log('[ChatPage] ⚠️ No messages with userId filter, trying without filter for existing data');
        storedMessages = await atlasDB.messages
          .where("conversationId")
          .equals(conversationId)
          .sortBy("timestamp");
      }
      
      // ✅ NEW: If Dexie is still empty, fetch from Supabase and sync to Dexie
      if (storedMessages.length === 0) {
        console.log('[ChatPage] 🔄 Dexie empty, fetching from Supabase...');
        
        const { data: supabaseMessages } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at');
        
        if (supabaseMessages && supabaseMessages.length > 0) {
          console.log('[ChatPage] ✅ Found', supabaseMessages.length, 'messages in Supabase, syncing to Dexie...');
          
          // Store in Dexie for future use
          await atlasDB.messages.bulkPut(
            supabaseMessages.map((msg: any) => ({
              id: msg.id,
              conversationId: msg.conversation_id,
              userId: msg.user_id,
              role: msg.role,
              type: msg.image_url ? 'image' : 'text', // ✅ Detect type from data
              content: msg.content,
              timestamp: msg.created_at,
              synced: true,
              updatedAt: msg.created_at,
              imageUrl: msg.image_url || undefined, // ✅ Save image URL
              image_url: msg.image_url || undefined, // ✅ Support both formats
              attachments: msg.attachments || undefined // ✅ Save attachments
            }))
          );
          
          // Reload from Dexie
          storedMessages = await atlasDB.messages
            .where("conversationId")
            .equals(conversationId)
            .sortBy("timestamp");
          
          console.log('[ChatPage] ✅ Synced', supabaseMessages.length, 'messages from Supabase to Dexie');
        } else {
          console.log('[ChatPage] ℹ️ No messages found in Supabase for conversation:', conversationId);
        }
      }
      
      const formattedMessages = storedMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        type: msg.type || 'text',
        url: msg.imageUrl || msg.image_url, // ✅ ADD: url field for ImageMessageBubble
        imageUrl: msg.imageUrl || msg.image_url, // ✅ Include image URL
        attachments: msg.attachments // ✅ Include attachments
      } as Message));
      
      // ✅ DEBUG: Log image messages being loaded
      const imageMessages = formattedMessages.filter(msg => msg.type === 'image');
      if (imageMessages.length > 0) {
        console.log('[ChatPage] 🔍 Loading image messages from Dexie:', imageMessages.map(msg => ({
          id: msg.id,
          type: msg.type,
          url: msg.url,
          imageUrl: msg.imageUrl,
          hasAttachments: !!msg.attachments
        })));
      }
      
      // Set React state (Dexie is authoritative source)
      setMessages(formattedMessages);
      console.log('[ChatPage] ✅ Loaded', formattedMessages.length, 'messages from Dexie');
      
      // ✅ Force React re-render by creating new array reference
      if (formattedMessages.length > 0) {
        setTimeout(() => {
          setMessages([...formattedMessages]);
        }, 50);
      }
    } catch (error) {
      console.error('[ChatPage] ❌ Failed to load messages:', error);
      setMessages([]);
    }
  }, [userId]); // ✅ MOBILE FIX: Add userId dependency to ensure proper filtering

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
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ OPTIMISTIC UPDATES: Show user message instantly for ChatGPT-like experience
  const handleTextMessage = async (text: string) => {
    // Prevent duplicate calls
    if (isProcessingRef.current) {
      console.log('[ChatPage] ⚠️ Message already processing, skipping...');
      return;
    }
    
    // Prevent duplicate content
    if (lastMessageRef.current === text.trim()) {
      console.log('[ChatPage] ⚠️ Duplicate content detected, skipping...');
      return;
    }
    
    if (!conversationId || !userId) {
      console.error('[ChatPage] ❌ Cannot send message: missing conversationId or userId', {
        conversationId,
        userId,
        hasConversationId: !!conversationId,
        hasUserId: !!userId
      });
      
      // Show user-friendly error
      alert('Please wait for authentication to complete before sending messages.');
      return;
    }
    
    lastMessageRef.current = text.trim();
    isProcessingRef.current = true;
    
    try {
      console.log('[ChatPage] 📤 Sending message to backend...', {
        userId,
        conversationId,
        text: text.slice(0, 50)
      });
      
      // ✅ OPTIMISTIC UPDATE: Show user message IMMEDIATELY
      const optimisticUserMessage: Message = {
        id: `temp-${Date.now()}`, // Temporary ID
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        type: 'text'
      };
      
      // Add to UI instantly for ChatGPT-like experience
      setMessages(prev => [...prev, optimisticUserMessage]);
      console.log('[ChatPage] ✅ Optimistic user message displayed:', optimisticUserMessage.id);
      
      // Show thinking indicator
      setIsTyping(true);
      setIsStreaming(true);
      
      // Send to backend - real-time listener will replace optimistic with real message
      await chatService.sendMessage(
        text, 
        () => {}, // No frontend status updates needed
        conversationId, 
        userId
      );
      
      console.log('[ChatPage] ✅ Message sent to backend, waiting for real-time updates...');
      
      // ✅ AUTO TITLE GENERATION: Generate title for first user message
      if (messages.length === 0) {
        // This is the first message in the conversation, generate title
        autoGenerateTitle({
          message: text,
          tier: tier || 'free',
          conversationId,
          userId
        }).catch(err => {
          console.warn('[ChatPage] Title generation failed (non-blocking):', err);
        });
      }
      
      // ✅ OPTIMIZED FALLBACK: Reduced timer for faster response (500ms)
      fallbackTimerRef.current = setTimeout(async () => {
        console.warn('[ChatPage] ⚠️ Real-time event not received, using fast fallback reload');
        setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
        await loadMessages(conversationId);
      }, 500); // ✅ Reduced from 1000ms to 500ms for faster response
      
      // Keep typing indicator active until real-time listener receives response
      
    } catch (error) {
      console.error('[ChatPage] ❌ Failed to send message:', error);
      
      // ✅ Clear fallback timer on error
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      
      // ✅ ROLLBACK: Remove optimistic message on error
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
      console.log('[ChatPage] ⚠️ Rolled back optimistic message due to error');
      
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
      
      // Clear duplicate check after 1 second
      setTimeout(() => {
        lastMessageRef.current = '';
      }, 1000);
    }
  };

  // ✅ FIX: Get authenticated user with better logging
  useEffect(() => {
    const getAuthUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[ChatPage] Auth check result:', {
          hasUser: !!user,
          userId: user?.id,
          userEmail: user?.email
        });
        
        if (user) {
          setUserId(user.id);
          console.log('[ChatPage] ✅ User authenticated:', user.id);
        } else {
          console.warn('[ChatPage] ⚠️ No authenticated user found');
          setUserId(null);
        }
      } catch (error) {
        console.error('[ChatPage] ❌ Auth check failed:', error);
        setUserId(null);
      }
    };
    getAuthUser();
  }, []);

  // ✅ PHASE 2: Real-time listener as SINGLE SOURCE OF TRUTH
  useEffect(() => {
    if (!userId || !conversationId) return;

    console.log('[ChatPage] 🔔 Setting up real-time listener (single writer) for conversation:', conversationId);

    // Listen for new messages in real-time
    const subscription = supabase
      .channel(`conversation_${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        // ✅ Clear fallback timer - real-time is working
        if (fallbackTimerRef.current) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
          console.log('[ChatPage] ✅ Real-time working, fallback timer cleared');
        }
        
        console.log('[ChatPage] 🔔 Real-time event RECEIVED:', payload.new?.id, payload.new?.role, payload.new?.content?.slice(0, 50)); // DEBUG LOG
        const newMsg = payload.new;
        
        console.log('[ChatPage] 🔔 Real-time message received:', {
          id: newMsg.id,
          role: newMsg.role,
          contentPreview: newMsg.content?.slice(0, 50),
          image_url: newMsg.image_url, // ✅ DEBUG: Check if image_url exists
          attachments: newMsg.attachments, // ✅ DEBUG: Check if attachments exist
          hasImageData: !!(newMsg.image_url || newMsg.attachments) // ✅ DEBUG: Quick check
        });
        
        try {
          // ✅ MOBILE FIX: Ensure database is ready before use
          await ensureDatabaseReady();
          
          // ✅ SINGLE WRITE PATH: Real-time listener writes to Dexie
          const messageToSave = {
            id: newMsg.id,
            conversationId: newMsg.conversation_id,
            userId: userId, // ✅ ALWAYS use authenticated userId, never trust backend
            role: newMsg.role,
            type: newMsg.image_url ? 'image' : 'text', // ✅ Detect type from message data
            content: newMsg.content,
            timestamp: newMsg.created_at,
            synced: true,
            updatedAt: newMsg.created_at,
            imageUrl: newMsg.image_url || undefined, // ✅ Save image URL
            image_url: newMsg.image_url || undefined, // ✅ Support both formats
            attachments: newMsg.attachments || undefined // ✅ Save attachments array
          };
          
          console.log('[ChatPage] 🔔 Saving to Dexie:', {
            id: messageToSave.id,
            type: messageToSave.type,
            hasImageUrl: !!messageToSave.imageUrl,
            hasImage_url: !!messageToSave.image_url,
            hasAttachments: !!messageToSave.attachments
          });
          
          await atlasDB.messages.put(messageToSave as any);
          
          console.log('[ChatPage] ✅ Message written to Dexie:', newMsg.id);
          
          // ✅ OPTIMISTIC UPDATE: Replace temporary message with real one
          if (newMsg.role === 'user') {
            setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
            console.log('[ChatPage] ✅ Removed optimistic message, real message from Dexie will replace it');
          }
          
          // ✅ Reload messages from Dexie (single source of truth)
          await loadMessages(conversationId);
          
          // Only reset indicators for assistant messages
          if (newMsg.role === 'assistant') {
            setIsStreaming(false);
            setIsTyping(false);
            console.log('[ChatPage] ✅ Reset typing indicators after assistant response');
          }
          
        } catch (error) {
          console.error('[ChatPage] ❌ Failed to write message to Dexie:', error);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[ChatPage] ✅ Real-time listener SUBSCRIBED for conversation:', conversationId);
        } else if (status === 'CLOSED') {
          console.log('[ChatPage] 🔕 Real-time listener closed (normal cleanup)');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[ChatPage] ⚠️ Real-time listener error, will retry on next message:', status);
        }
      });

    return () => {
      console.log('[ChatPage] 🔕 Cleaning up real-time listener');
      supabase.removeChannel(subscription);
    };
  }, [userId, conversationId]);

  // ✅ ENTERPRISE: Handle redirect when current conversation is deleted
  useEffect(() => {
    if (!conversationId) return;

    const handleConversationDeleted = (event: CustomEvent) => {
      const deletedId = event.detail.conversationId;
      if (conversationId === deletedId) {
        logger.debug('[ChatPage] 🔄 Redirecting to new chat (current conversation deleted)');
        window.location.href = '/chat';
      }
    };

    window.addEventListener('conversationDeleted', handleConversationDeleted as EventListener);
    
    return () => {
      window.removeEventListener('conversationDeleted', handleConversationDeleted as EventListener);
    };
  }, [conversationId]);

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
        
        // ✅ PHASE 2: Switching to conversation
        console.log('[ChatPage] 🔄 Switching to conversation:', id);
        
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
          
          // ✅ ADD THIS LINE: Sync conversations from Supabase to local Dexie
          await conversationSyncService.syncConversationsFromRemote(userId);
          
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

  // ✅ MOBILE FIX: Handle URL changes without page reload (for conversation selection)
  // Set up listener immediately to avoid race conditions
  useEffect(() => {
    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlConversationId = urlParams.get('conversation');
      
      // Only switch if URL has a different conversation ID
      if (urlConversationId && urlConversationId !== conversationId) {
        console.log('[ChatPage] 🔄 URL changed, switching conversation:', urlConversationId);
        
        // Update conversation ID and load messages
        localStorage.setItem('atlas:lastConversationId', urlConversationId);
        setConversationId(urlConversationId);
        
        // Only load messages if userId is available
        if (userId) {
          loadMessages(urlConversationId);
        } else {
          console.log('[ChatPage] ⚠️ userId not ready yet, will load messages when available');
        }
      }
    };
    
    // Listen for browser back/forward navigation
    window.addEventListener('popstate', handleUrlChange);
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, [conversationId, loadMessages, userId]); // Keep userId in deps for loadMessages calls

  // ✅ MOBILE FIX: Load messages when userId becomes available
  useEffect(() => {
    if (userId && conversationId) {
      console.log('[ChatPage] 🔄 userId available, loading messages for conversation:', conversationId);
      loadMessages(conversationId);
    }
  }, [userId, conversationId, loadMessages]);

  // Removed - redundant with main message loading useEffect

  // Removed - no longer needed with direct navigation

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

  // Cleanup background sync and fallback timer on unmount
  useEffect(() => {
    return () => {
      stopBackgroundSync();
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
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

  // ✅ FIX: Show authentication status
  if (!userId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center p-6">
        <div className="p-6 bg-blue-100 text-blue-800 rounded-xl text-center max-w-md border border-blue-200">
          <div className="text-lg font-semibold mb-2">Authenticating...</div>
          <div className="mb-4">Please wait while we verify your identity.</div>
          <div className="flex justify-center">
            <svg
              className="animate-spin h-6 w-6 text-blue-700"
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
        </div>
      </div>
    );
  }

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
                  <QuickActions onViewHistory={handleViewHistory} />
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
                        
        {/* ✅ Simple typing dots - back to working pattern */}
        {(() => {
          const safeMessages = messages || [];
          const hasUserMessage = safeMessages.some(m => m.role === 'user');
          
          if (isStreaming && hasUserMessage) {
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
            <div className="flex items-center space-x-3 px-4 py-3 bg-gray-800/50 rounded-2xl">
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
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
                isStreaming={isStreaming}
                addMessage={addMessage}
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


        {/* Conversation History Modal - Rendered at page level for proper mobile centering */}
        {historyData && (
          <ConversationHistoryDrawer
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
            conversations={historyData.conversations}
            onDeleteConversation={historyData.onDeleteConversation}
            deletingId={historyData.deletingId}
          />
        )}
        
      </div>
    </ErrorBoundary>
  );
};

export default ChatPage;