import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, Search, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
// Removed - Using VoiceUpgradeModal for all upgrades for consistent warm UI
// import EnhancedUpgradeModal from '../components/EnhancedUpgradeModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MessageListWithPreviews } from '../components/MessageListWithPreviews';
import { ScrollToBottomButton } from '../components/ScrollToBottomButton';
import EnhancedInputToolbar from '../components/chat/EnhancedInputToolbar';
import EnhancedMessageBubble from '../components/chat/EnhancedMessageBubble';
import { ProfileSettingsModal } from '../components/modals/ProfileSettingsModal';
import VoiceUpgradeModal from '../components/modals/VoiceUpgradeModal';
import { useUpgradeModals } from '../contexts/UpgradeModalContext';
import { atlasDB, ensureDatabaseReady } from '../database/atlasDB';
import { messageService } from '../features/chat/services/messageService';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useMemoryIntegration } from '../hooks/useMemoryIntegration';
import { useTierQuery } from '../hooks/useTierQuery'; // 🔥 Use modern tier hook
import { useThemeMode } from '../hooks/useThemeMode'; // ✅ Theme support
import { logger } from '../lib/logger';
import { checkSupabaseHealth, supabase } from '../lib/supabaseClient';
import { chatService } from '../services/chatService';
import { databaseMigration } from '../services/databaseMigration';
import { startBackgroundSync, stopBackgroundSync } from '../services/syncService';
import { autoGenerateTitle } from '../services/titleGenerationService';
import type { Message } from '../types/chat';
import { generateUUID } from '../utils/uuid';

// Sidebar components
import { ConversationHistoryDrawer } from '../components/ConversationHistoryDrawer';
import { SearchDrawer } from '../components/SearchDrawer';
import InsightsWidget from '../components/sidebar/InsightsWidget';
import PrivacyToggle from '../components/sidebar/PrivacyToggle';
import QuickActions from '../components/sidebar/QuickActions';
import UsageCounter from '../components/sidebar/UsageCounter';
import { useRealtimeConversations } from '../hooks/useRealtimeConversations';

interface ChatPageProps {
  user?: { id: string; email?: string };
}

const ChatPage: React.FC<ChatPageProps> = () => {
  const navigate = useNavigate();
  const {
    voiceModalVisible,
    hideVoiceUpgrade,
    genericModalVisible,
    hideGenericUpgrade,
    genericModalFeature,
  } = useUpgradeModals();
  
  const [healthError, setHealthError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Profile modal state
  const [showProfile, setShowProfile] = useState(false);
  
  // Get user email for avatar
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // History modal state
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<{
    conversations: any[];
    onDeleteConversation: (id: string) => void;
    deletingId: string | null;
    onRefresh?: () => Promise<void>;
  } | null>(null);
  
  // Search modal state
  const [showSearch, setShowSearch] = useState(false);
  
  // Removed duplicate useMessageStore - using usePersistentMessages as single source of truth
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Memory integration
  useMemoryIntegration({ userId: userId || undefined });

  // 🔥 Modern tier management with React Query + Realtime
  const { tier } = useTierQuery();
  
  // ✅ Theme support
  const { isDarkMode } = useThemeMode();

  // ✅ ENTERPRISE: Real-time conversation deletion listener (clean, reliable)
  useRealtimeConversations(userId || undefined);

  // Handle history modal from QuickActions
  const handleViewHistory = (data: {
    conversations: any[];
    onDeleteConversation: (id: string) => void;
    deletingId: string | null;
    onRefresh?: () => Promise<void>;
  }) => {
    setHistoryData(data);
    setShowHistory(true);
    setSidebarOpen(false); // ✅ Close main sidebar when opening history
  };

  // ✅ PHASE 2: Messages state - only updated by loadMessages (from Dexie)
  const [messages, setMessages] = useState<Message[]>([]);
  
  // ✅ Add message function for image uploads
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);
  
  // ✅ OPTIMIZATION: Session-scoped cache to prevent redundant message loads (5s window)
  const messageLoadCache = useRef(new Map<string, { timestamp: number; promise: Promise<Message[]> }>()).current;
  
  // ✅ PHASE 2: Load messages from Dexie (read-only, single source of truth)
  const loadMessages = useCallback(async (conversationId: string) => {
    const startTime = performance.now();
    try {
      // ✅ MOBILE FIX: Ensure userId is available before loading messages
      if (!userId) {
        logger.debug('[ChatPage] ⚠️ userId not available yet, skipping message load');
        return;
      }
      
      // ✅ OPTIMIZATION: Check cache first to prevent redundant loads
      const cacheKey = `${conversationId}-${userId}`;
      const cached = messageLoadCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 5000) {
        logger.debug(`[ChatPage] ⚡ Using cached messages for ${conversationId} (${Date.now() - cached.timestamp}ms ago)`);
        return cached.promise;
      }
      
      logger.debug('[ChatPage] 🔍 loadMessages called with:', { conversationId, userId });
      
      // ✅ MOBILE FIX: Ensure database is ready before use
      await ensureDatabaseReady();
      
      // ✅ PERFORMANCE: Load all messages in one optimized query
      let storedMessages = await atlasDB.messages
        .where("conversationId")
        .equals(conversationId)
        .sortBy("timestamp");
      
      // ✅ PERFORMANCE: Filter deleted messages in JavaScript (already in memory)
      storedMessages = storedMessages.filter(msg => !msg.deletedAt);
      
      logger.debug('[ChatPage] 🔍 Loaded messages for conversation:', {
        conversationId,
        count: storedMessages.length,
        loadTime: `${(performance.now() - startTime).toFixed(0)}ms`
      });
      
      const formattedMessages = storedMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        type: msg.type || 'text',
        // ✅ FIX: Don't duplicate - use ONLY attachments array
        attachments: msg.attachments // ✅ Include attachments
      } as Message));
      
      // Set React state (Dexie is authoritative source)
      setMessages(formattedMessages);
      logger.debug('[ChatPage] ✅ Loaded', formattedMessages.length, 'messages from Dexie');
      
      // ✅ OPTIMIZATION: Cache the promise and result
      const loadPromise = Promise.resolve(formattedMessages);
      messageLoadCache.set(cacheKey, { timestamp: Date.now(), promise: loadPromise });
      
      // Clean up cache after 5s
      setTimeout(() => {
        messageLoadCache.delete(cacheKey);
      }, 5000);
      
      return formattedMessages;
    } catch (error) {
      logger.error('[ChatPage] ❌ Failed to load messages:', error);
      logger.error('[ChatPage] ❌ Error details:', {
        conversationId,
        userId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      setMessages([]);
    }
  }, [userId]); // ✅ MOBILE FIX: Add userId dependency to ensure proper filtering

  // Messages container ref for scroll detection
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Modern scroll system with golden sparkle
  const { bottomRef, scrollToBottom, showScrollButton, shouldGlow } = useAutoScroll([messages.length], messagesContainerRef);
  
  // Auto-scroll when messages change (only if length changes, not on every re-render)
  useEffect(() => {
    if (messages && messages.length > 0) {
      // ✅ Use requestAnimationFrame for smooth scroll (no visual jump)
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      });
    }
  }, [messages.length]); // ✅ Only scroll when length changes, not on every update

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
      const supabase = (await import('../lib/supabase')).default;
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (error) {
      // Silent fail - logout will redirect regardless
    }
  };

  // Upgrade modal state (legacy - keeping for compatibility)
  const [upgradeModalVisible, setUpgradeModalVisible] = React.useState(false);
  const [upgradeReason, setUpgradeReason] = React.useState('monthly limit');
  const [currentUsage, setCurrentUsage] = React.useState<number | undefined>();
  const [limit, setLimit] = React.useState<number | undefined>();

  // Use context modal state when available, fallback to local state
  const isGenericModalOpen = genericModalVisible || upgradeModalVisible;
  const closeGenericModal = () => {
    hideGenericUpgrade();
    setUpgradeModalVisible(false);
  };

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
      logger.debug('[ChatPage] ⚠️ Message already processing, skipping...');
      return;
    }
    
    // Prevent duplicate content
    if (lastMessageRef.current === text.trim()) {
      logger.debug('[ChatPage] ⚠️ Duplicate content detected, skipping...');
      return;
    }
    
    if (!conversationId || !userId) {
      logger.error('[ChatPage] ❌ Cannot send message: missing conversationId or userId', {
        conversationId,
        userId,
        hasConversationId: !!conversationId,
        hasUserId: !!userId
      });
      
      // Show user-friendly error
      toast.error('Please wait for authentication to complete before sending messages.');
      return;
    }
    
    lastMessageRef.current = text.trim();
    isProcessingRef.current = true;
    
    // ✅ FIX: Check message count BEFORE optimistic update
    const isFirstMessage = messages.length === 0;
    
    try {
      logger.debug('[ChatPage] 📤 Sending message to backend...', {
        userId,
        conversationId,
        text: text.slice(0, 50)
      });
      
      // ✅ OPTIMISTIC UPDATE: Show user message IMMEDIATELY
      const userMessageId = crypto.randomUUID();
      const optimisticUserMessage: Message = {
        id: userMessageId,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        type: 'text',
        status: 'sending' // ✅ NEW: Show sending status
      };
      
      // ✅ CRITICAL: Save user message to Dexie IMMEDIATELY
      await atlasDB.messages.put({
        id: userMessageId,
        conversationId: conversationId,
        userId: userId,
        role: 'user',
        content: text,
        timestamp: optimisticUserMessage.timestamp,
        type: 'text',
        synced: false, // Will be synced to Supabase by backend
        updatedAt: optimisticUserMessage.timestamp
      });
      logger.debug('[ChatPage] ✅ User message saved to Dexie:', userMessageId);
      
      // ✅ FIX: Batch all updates together to prevent any glitch
      setMessages(prev => [...prev, optimisticUserMessage]);
      setIsTyping(true);
      setIsStreaming(true);
      logger.debug('[ChatPage] ✅ Optimistic user message displayed with typing indicators:', optimisticUserMessage.id);
      
      // Send to backend - real-time listener will replace optimistic with real message
      await chatService.sendMessage(
        text, 
        () => {}, // No frontend status updates needed
        conversationId, 
        userId
      );
      
      logger.debug('[ChatPage] ✅ Message sent to backend, waiting for real-time updates...');
      
      // ✅ AUTO TITLE GENERATION: Generate title for first user message OR if conversation has generic title
      if (isFirstMessage) {
        // This is the first message in the conversation, generate title
        autoGenerateTitle({
          message: text,
          tier: tier || 'free',
          conversationId,
          userId
        }).catch(err => {
          logger.warn('[ChatPage] Title generation failed (non-blocking):', err);
        });
      } else {
        // ✅ FIX: Also check if conversation has generic title and regenerate it
        try {
          const conversation = await atlasDB.conversations.get(conversationId);
          const genericTitles = [
            'New Conversation',
            'Default Conversation',
            'Untitled',
            'New conversation',
            'Chat',
            'hi' // Common generic title
          ];
          
          if (conversation && genericTitles.some(generic => 
            conversation.title?.toLowerCase().startsWith(generic.toLowerCase())
          )) {
            logger.debug('[ChatPage] 🔄 Regenerating generic title:', conversation.title);
            autoGenerateTitle({
              message: text,
              tier: tier || 'free',
              conversationId,
              userId
            }).catch(err => {
              logger.warn('[ChatPage] Title regeneration failed (non-blocking):', err);
            });
          }
        } catch (err) {
          logger.debug('[ChatPage] Could not check conversation title (non-blocking):', err);
        }
      }
      
      // ✅ BULLETPROOF FALLBACK: If realtime fails, fetch directly from Supabase after 2s
      fallbackTimerRef.current = setTimeout(async () => {
        logger.warn('[ChatPage] ⚠️ Real-time not received after 2s, fetching from Supabase');
        
        // Fetch latest 10 messages from Supabase
        const { data: latestMessages, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (!error && latestMessages && latestMessages.length > 0) {
          // Save to Dexie immediately
          await atlasDB.messages.bulkPut(
            latestMessages.map((msg: any) => ({
              id: msg.id,
              conversationId: msg.conversation_id,
              userId: msg.user_id || userId,
              role: msg.role,
              type: 'text',
              content: msg.content,
              timestamp: msg.created_at,
              synced: true,
              updatedAt: msg.created_at,
              attachments: msg.attachments || undefined,
              deletedAt: msg.deleted_at || undefined,
              deletedBy: msg.deleted_by || undefined
            }))
          );
          logger.debug('[ChatPage] ✅ Fallback: Saved', latestMessages.length, 'messages to Dexie');
        }
        
        // Reload from Dexie to display
        await loadMessages(conversationId);
        setIsTyping(false);
        setIsStreaming(false);
      }, 2000); // ✅ 2-second fallback ensures messages always appear
      
      // Keep typing indicator active until real-time listener receives response
      
    } catch (error) {
      logger.error('[ChatPage] ❌ Failed to send message:', error);
      
      // ✅ Clear fallback timer on error
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      
      // ✅ ROLLBACK: Remove optimistic message on error
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
      logger.debug('[ChatPage] ⚠️ Rolled back optimistic message due to error');
      
      setIsTyping(false);
      setIsStreaming(false);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          // User cancelled - this is expected, don't show error
          logger.info('[ChatPage] ✅ User cancelled message generation');
          return;
        }
        
        if (error.message === 'MONTHLY_LIMIT_REACHED') {
          setCurrentUsage(15);
          setLimit(15);
          setUpgradeReason('monthly message limit');
          setUpgradeModalVisible(true);
          return;
        }
      }
    } finally {
      isProcessingRef.current = false;
      
      // Clear duplicate check after 1 second
      setTimeout(() => {
        lastMessageRef.current = '';
      }, 1000);
    }
  };

  // ✅ Stop generation handler
  const handleStopGeneration = () => {
    chatService.stopMessageStream();
    setIsTyping(false);
    setIsStreaming(false);
    
    // Clear the fallback timer if it exists
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    
    logger.info('[ChatPage] User stopped message generation');
    toast.info('Generation stopped', { duration: 2000 });
  };

  // ✅ PHASE 2: Delete message handler (soft delete)
  const handleDeleteMessage = async (messageId: string, deleteForEveryone: boolean) => {
    if (!conversationId || !userId) {
      logger.error('[ChatPage] ❌ Cannot delete message: missing conversationId or userId');
      return;
    }

    try {
      logger.debug('[ChatPage] 🗑️ Deleting message:', { messageId, deleteForEveryone });

      // ✅ Optimistic update: Mark message as deleted in UI immediately
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { 
              ...msg, 
              deletedAt: new Date().toISOString(),
              deletedBy: deleteForEveryone ? 'everyone' : 'user'
            } 
          : msg
      ));

      // ✅ Update Dexie
      await atlasDB.messages.update(messageId, {
        deletedAt: new Date().toISOString(),
        deletedBy: deleteForEveryone ? 'everyone' : 'user'
      });

      // ✅ Update Supabase (backend)
      await messageService.deleteMessage(messageId, conversationId, deleteForEveryone);

      logger.debug('[ChatPage] ✅ Message deleted successfully');
    } catch (error) {
      logger.error('[ChatPage] ❌ Failed to delete message:', error);
      
      // Revert optimistic update on error
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, deletedAt: undefined, deletedBy: undefined } 
          : msg
      ));
      
      // Show error to user
      toast.error('Failed to delete message. Please try again.');
    }
  };

  // ✅ Edit message handler
  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!conversationId || !userId) {
      logger.error('[ChatPage] ❌ Cannot edit message: missing conversationId or userId');
      return;
    }

    try {
      logger.debug('[ChatPage] ✏️ Editing message:', { messageId, newContent });

      // Store original message for rollback
      const originalMessage = messages.find(msg => msg.id === messageId);
      if (!originalMessage) {
        logger.error('[ChatPage] ❌ Message not found for editing');
        return;
      }

      // ✅ Optimistic update: Update message in UI immediately
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { 
              ...msg, 
              content: newContent,
              editedAt: new Date().toISOString()
            } 
          : msg
      ));

      // ✅ Update Dexie
      await atlasDB.messages.update(messageId, {
        content: newContent,
        editedAt: new Date().toISOString()
      });

      // ✅ Update Supabase (backend)
      await messageService.editMessage(messageId, newContent, conversationId);

      logger.debug('[ChatPage] ✅ Message edited successfully');
    } catch (error) {
      logger.error('[ChatPage] ❌ Failed to edit message:', error);
      
      // Revert optimistic update on error
      const originalMessage = messages.find(msg => msg.id === messageId);
      if (originalMessage) {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: originalMessage.content, editedAt: undefined } 
            : msg
        ));
      }
      
      // Show error to user
      toast.error('Failed to edit message. Please try again.');
    }
  };

  // ✅ PHASE 2B: Navigate to message from search
  const handleNavigateToMessage = async (targetConversationId: string, messageId: string) => {
    try {
      logger.debug('[ChatPage] 🔍 Navigating to message:', { targetConversationId, messageId });

      // Switch conversation if needed
      if (targetConversationId !== conversationId) {
        setConversationId(targetConversationId);
        await loadMessages(targetConversationId);
      }

      // Wait for messages to load
      await new Promise(resolve => setTimeout(resolve, 300));

      // Scroll to message
      const messageElement = document.getElementById(`message-${messageId}`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight message briefly
        messageElement.classList.add('ring-2', 'ring-yellow-400', 'rounded-lg');
        setTimeout(() => {
          messageElement.classList.remove('ring-2', 'ring-yellow-400', 'rounded-lg');
        }, 2000);
      } else {
        logger.warn('[ChatPage] ⚠️ Message element not found:', messageId);
      }
    } catch (error) {
      logger.error('[ChatPage] ❌ Failed to navigate to message:', error);
    }
  };

  // ✅ FIX: Get authenticated user with better logging
  useEffect(() => {
    const getAuthUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        logger.debug('[ChatPage] Auth check result:', {
          hasUser: !!user,
          userId: user?.id,
          userEmail: user?.email
        });
        
        if (user) {
          setUserId(user.id);
          setUserEmail(user.email || null);
          logger.debug('[ChatPage] ✅ User authenticated:', user.id);
        } else {
          logger.warn('[ChatPage] ⚠️ No authenticated user found');
          setUserId(null);
        }
      } catch (error) {
        logger.error('[ChatPage] ❌ Auth check failed:', error);
        
        // Development fallback when Supabase is unreachable
        if (import.meta.env.DEV) {
          logger.warn('[ChatPage] 🔧 Using development fallback user');
          // Use the user ID from the console logs
          const fallbackUserId = '0a8726d5-af01-44d3-b635-f0d276d3d3d3';
          const fallbackEmail = 'jasonc.jpg@gmail.com';
          setUserId(fallbackUserId);
          setUserEmail(fallbackEmail);
          return;
        }
        
        setUserId(null);
      }
    };
    getAuthUser();
  }, []);

  // ✅ PHASE 2B: Keyboard shortcut for search (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
        logger.debug('[ChatPage] 🔍 Search opened via keyboard shortcut');
      }

      // Escape to close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  // ✅ PHASE 2: Real-time listener as SINGLE SOURCE OF TRUTH
  useEffect(() => {
    if (!userId || !conversationId) return;

    logger.debug('[ChatPage] 🔔 Setting up real-time listener (single writer) for conversation:', conversationId);

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
          logger.debug('[ChatPage] ✅ Real-time working, fallback timer cleared');
        }
        
        logger.debug('[ChatPage] 🔔 Real-time event RECEIVED:', payload.new?.id, payload.new?.role, payload.new?.content?.slice(0, 50)); // DEBUG LOG
        const newMsg = payload.new;
        
        logger.debug('[ChatPage] 🔔 Real-time message received:', {
          id: newMsg.id,
          role: newMsg.role,
          contentPreview: newMsg.content?.slice(0, 50),
          hasImageData: !!(newMsg.image_url || newMsg.attachments)
        });
        
        try {
          // ✅ MOBILE FIX: Ensure database is ready before use
          await ensureDatabaseReady();
          
          // ✅ SINGLE WRITE PATH: Real-time listener writes to Dexie
          // ✅ FIX: Parse JSON content if it's a stringified object
          let parsedContent = newMsg.content;
          if (typeof newMsg.content === 'string') {
            try {
              // Check if content looks like JSON
              if (newMsg.content.trim().startsWith('{') && newMsg.content.includes('"type"') && newMsg.content.includes('"text"')) {
                const parsed = JSON.parse(newMsg.content);
                // Extract the actual text from {type: "text", text: "..."}
                parsedContent = parsed.text || parsed.content || newMsg.content;
              }
            } catch (e) {
              // Not JSON, keep as-is
              parsedContent = newMsg.content;
            }
          }
          
          const messageToSave = {
            id: newMsg.id,
            conversationId: newMsg.conversation_id,
            userId: userId, // ✅ ALWAYS use authenticated userId, never trust backend
            role: newMsg.role,
            type: (newMsg.image_url ? 'image' : 'text') as 'text' | 'image' | 'audio', // ✅ Detect type from message data
            content: parsedContent, // ✅ FIX: Use parsed content
            timestamp: newMsg.created_at,
            synced: true,
            updatedAt: newMsg.created_at,
            // ✅ FIX: Don't duplicate - use ONLY attachments array
            attachments: newMsg.attachments || undefined, // ✅ Save attachments array
            deletedAt: newMsg.deleted_at || undefined, // ✅ PHASE 2: Sync deleted status
            deletedBy: newMsg.deleted_by || undefined  // ✅ PHASE 2: Sync deleted type
          };
          
          logger.debug('[ChatPage] 🔔 Saving to Dexie:', {
            id: messageToSave.id,
            type: messageToSave.type,
            hasAttachments: !!messageToSave.attachments
          });
          
          await atlasDB.messages.put(messageToSave as any);
          
          logger.debug('[ChatPage] ✅ Message written to Dexie:', newMsg.id);
          
          // ✅ SMOOTH UPDATE: Replace optimistic message with real one - NO RELOAD
          const realMessage: Message = {
            id: messageToSave.id,
            role: messageToSave.role,
            type: messageToSave.type as 'text' | 'image' | 'audio',
            content: messageToSave.content,
            timestamp: messageToSave.timestamp,
            status: 'sent' as const,
            // ✅ FIX: Don't duplicate - use ONLY attachments array
            attachments: messageToSave.attachments
          };
          
          // ✅ Update UI with real message, replacing optimistic one
          setMessages(prev => {
            // ✅ FIX: Only remove the optimistic message if this is a user message being replaced
            // Don't remove ALL temp messages when assistant responds!
            let updatedMessages = [...prev];
            
            if (realMessage.role === 'user') {
              // For user messages, find and replace the matching temp message
              const tempIndex = updatedMessages.findIndex(m => 
                m.id.startsWith('temp-') && 
                m.content === realMessage.content &&
                m.role === 'user'
              );
              
              if (tempIndex !== -1) {
                // Replace the temp message with the real one
                updatedMessages[tempIndex] = realMessage;
                return updatedMessages;
              }
            }
            
            // For assistant messages or if no temp message found, just add/update normally
            const existingIndex = updatedMessages.findIndex(m => m.id === realMessage.id);
            
            if (existingIndex !== -1) {
              // Update existing message
              updatedMessages[existingIndex] = realMessage;
              return updatedMessages;
            } else {
              // Add new message
              return [...updatedMessages, realMessage];
            }
          });
          
          logger.debug('[ChatPage] ✅ Smoothly replaced optimistic with real message:', newMsg.id);
          
          // ✅ FIX GLITCH #1: Batch all state updates together to prevent double re-render
          if (newMsg.role === 'assistant') {
            // Use startTransition to batch updates (React 18+)
            React.startTransition(() => {
              setIsStreaming(false);
              setIsTyping(false);
            });
            logger.debug('[ChatPage] ✅ Reset typing indicators after assistant response (batched)');
          }
          
        } catch (error) {
          logger.error('[ChatPage] ❌ Failed to write message to Dexie:', error);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        logger.debug('[ChatPage] 🔔 Real-time UPDATE event received:', payload.new?.id);
        const updatedMsg = payload.new;
        
        try {
          // ✅ PHASE 2: Sync message updates (deletions) in real-time
          if (updatedMsg.deleted_at) {
            logger.debug('[ChatPage] 🗑️ Message deleted remotely, updating local:', updatedMsg.id);
            
            // Update Dexie
            await atlasDB.messages.update(updatedMsg.id, {
              deletedAt: updatedMsg.deleted_at,
              deletedBy: updatedMsg.deleted_by || 'user'
            });
            
            // Update UI state
            setMessages(prev => prev.map(msg => 
              msg.id === updatedMsg.id 
                ? { ...msg, deletedAt: updatedMsg.deleted_at, deletedBy: updatedMsg.deleted_by || 'user' } 
                : msg
            ));
            
            logger.debug('[ChatPage] ✅ Message delete synced in real-time');
          }
        } catch (error) {
          logger.error('[ChatPage] ❌ Failed to sync message update:', error);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('[ChatPage] ✅ Real-time listener SUBSCRIBED for conversation:', conversationId);
        } else if (status === 'CLOSED') {
          logger.debug('[ChatPage] 🔕 Real-time listener closed (normal cleanup)');
        } else if (status === 'CHANNEL_ERROR') {
          logger.warn('[ChatPage] ⚠️ Real-time listener error, will retry on next message:', status);
        }
      });

    return () => {
      logger.debug('[ChatPage] 🔕 Cleaning up real-time listener');
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
        logger.debug('[ChatPage] 🔄 Switching to conversation:', id);
        
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
          // ✅ OPTIMIZED: Delta sync already handles both conversations AND messages
          await conversationSyncService.deltaSync(userId);
          
          // DON'T call loadMessages again - real-time listener will handle new messages
          logger.debug('[ChatPage] ✅ Initial sync complete, real-time listener active');
        } catch (error) {
          logger.error('[ChatPage] Initial sync failed:', error);
        }
        
      } catch (error) {
        logger.error('[ChatPage] Failed to initialize conversation:', error);
      }
    };

    initializeConversation();
  }, [userId]);
  
  // ✅ CRITICAL FIX: Ensure messages load when BOTH userId and conversationId are available
  // This handles the race condition where conversationId is set before userId on refresh
  useEffect(() => {
    if (userId && conversationId) {
      logger.debug('[ChatPage] 🔄 Both userId and conversationId available, loading messages...');
      loadMessages(conversationId);
    }
  }, [userId, conversationId, loadMessages]);

  // ✅ MOBILE FIX: Handle URL changes without page reload (for conversation selection)
  // Set up listener immediately to avoid race conditions
  useEffect(() => {
    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlConversationId = urlParams.get('conversation');
      
      // Only switch if URL has a different conversation ID
      if (urlConversationId && urlConversationId !== conversationId) {
        logger.debug('[ChatPage] 🔄 URL changed, switching conversation:', urlConversationId);
        
        // Update conversation ID and load messages
        localStorage.setItem('atlas:lastConversationId', urlConversationId);
        setConversationId(urlConversationId);
        
        // Only load messages if userId is available
        if (userId) {
          loadMessages(urlConversationId);
        } else {
          logger.debug('[ChatPage] ⚠️ userId not ready yet, will load messages when available');
        }
      }
    };
    
    // Listen for browser back/forward navigation
    window.addEventListener('popstate', handleUrlChange);
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, [conversationId, userId]); // Note: loadMessages deliberately excluded - stable callback with userId dependency

  // ✅ MOBILE FIX: Load messages when userId becomes available
  // Note: loadMessages not in deps to prevent infinite loop (stable callback with userId dependency)
  useEffect(() => {
    if (userId && conversationId) {
      logger.debug('[ChatPage] 🔄 userId available, loading messages for conversation:', conversationId);
      loadMessages(conversationId);
    }
  }, [userId, conversationId]); // Note: loadMessages deliberately excluded - stable callback

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
        logger.error('[ChatPage] Migration error:', error);
        try {
          await databaseMigration.clearAllData();
        } catch (clearError) {
          logger.error('[ChatPage] Failed to clear data:', clearError);
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
        logger.error('[ChatPage] Background sync initialization error:', error);
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
      // ✅ FIX: Cleanup resendService online listener
      import('../services/resendService').then(({ cleanupResendListeners }) => {
        cleanupResendListeners();
      });
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

  // ✅ FIX: Show authentication status with skeleton loading
  if (!userId) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Header Skeleton */}
        <div 
          className={`sticky top-0 z-30 transition-all duration-300`}
          style={{ 
            background: 'transparent',
            backgroundColor: 'transparent',
            backdropFilter: 'none',
            borderBottom: 'none'
          }}
        >
          <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <Skeleton circle width={40} height={40} />
                <div>
                  <Skeleton width={120} height={24} />
                  <Skeleton width={200} height={16} className="mt-1" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages Skeleton */}
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${i % 2 === 0 ? 'ml-auto' : ''}`}>
                <Skeleton height={60} borderRadius={16} />
              </div>
            </div>
          ))}
        </div>

        {/* Input Skeleton */}
        <div 
          className={`fixed bottom-0 left-0 right-0 p-4`}
          style={{ 
            background: 'transparent',
            borderTop: 'none'
          }}
        >
          <div className="max-w-4xl mx-auto">
            <Skeleton height={50} borderRadius={25} />
          </div>
        </div>
      </div>
    );
  }

  // ✅ MODERN: Show health error fallback if Supabase is unreachable (2024/2025 design)
  if (healthError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center p-6">
        {/* Modern glassmorphism error card */}
        <div className="relative max-w-md w-full">
          {/* Backdrop blur container */}
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/5 rounded-3xl blur-xl"></div>
          
          {/* Main card */}
          <div className="relative p-8 bg-gray-900/80 backdrop-blur-xl border border-yellow-500/20 rounded-3xl shadow-2xl">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-gradient-to-br from-yellow-500/20 to-orange-500/10 rounded-2xl border border-yellow-500/30">
                <svg className="w-12 h-12 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            
            {/* Title */}
            <h2 className="text-2xl font-bold text-white text-center mb-3">Connection Issue</h2>
            
            {/* Message */}
            <p className="text-gray-300 text-center mb-6 leading-relaxed">{healthError}</p>
            
            {/* Status indicator */}
            {retrying && (
              <div className="flex items-center justify-center gap-3 mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <svg
                  className="animate-spin h-5 w-5 text-yellow-400"
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
                <span className="text-sm text-yellow-300 font-medium">Reconnecting automatically...</span>
              </div>
            )}
            
            {/* Action button */}
            <button
              onClick={async () => {
                // ✅ MOBILE FIX: Try graceful recovery before full reload
                setRetrying(true);
                try {
                  // Try to reconnect to Supabase
                  await checkSupabaseHealth();
                  
                  // If successful, clear error and continue
                  setHealthError(null);
                  logger.debug('[ChatPage] ✅ Reconnection successful, resuming...');
                } catch (error) {
                  // If still failing, do a full reload as last resort
                  logger.error('[ChatPage] Reconnection failed, reloading...', error);
                  window.location.reload();
                } finally {
                  setRetrying(false);
                }
              }}
              disabled={retrying}
              className="w-full py-3 px-6 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-yellow-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {retrying ? 'Reconnecting...' : 'Reload Atlas Now'}
            </button>
            
            {/* Help text */}
            <p className="mt-4 text-xs text-gray-500 text-center">
              This usually fixes itself in 30 seconds. Click reload to retry immediately.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}>
        {/* Header - Fully transparent like footer */}
        <div 
          className={`sticky top-0 z-30 transition-all duration-300`}
          style={{ 
            background: 'transparent',
            backgroundColor: 'transparent',
            backdropFilter: 'none',
            borderBottom: 'none'
          }}
        >
          <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 rounded-lg bg-atlas-sage/10 hover:bg-atlas-sage/20 transition-colors"
                >
                  <Menu className="w-5 h-5 text-atlas-stone" />
                </button>
                <div>
                  <h1 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`} style={{ color: '#000000', fontWeight: 700 }}>Atlas AI</h1>
                  <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm sm:text-base hidden sm:block`}>Your emotionally intelligent AI assistant</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                {/* Search Button - PHASE 2B */}
                <button
                  onClick={() => setShowSearch(true)}
                  className="p-2 rounded-lg bg-atlas-sage/10 hover:bg-atlas-sage/20 transition-colors group"
                  title="Search messages (Cmd+K)"
                  aria-label="Search messages"
                >
                  <Search className="w-5 h-5 text-atlas-stone group-hover:text-atlas-sage" />
                </button>
                {/* Sync status hidden per design requirements */}
                {/* <SyncStatus isOnline={true} /> */}
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
                className="fixed left-0 top-0 h-full w-80 bg-atlas-pearl border-r border-atlas-border z-50 overflow-y-auto shadow-xl"
              >
                <div className="p-4 space-y-6">
                  {/* Header with Profile and Close Buttons */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-atlas-text-dark">Menu</h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowProfile(true)}
                        className="p-2 rounded-xl bg-atlas-button hover:bg-atlas-button-hover transition-colors"
                        aria-label="Open profile settings"
                        title="Profile Settings"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-atlas-gradient-start to-atlas-gradient-end flex items-center justify-center text-sm font-semibold text-gray-900">
                          {userEmail?.[0]?.toUpperCase() || '?'}
                        </div>
                      </button>
                      <button
                        onClick={() => setSidebarOpen(false)}
                        className="p-2 rounded-xl bg-atlas-button hover:bg-atlas-button-hover transition-colors"
                        aria-label="Close menu"
                      >
                        <X className="w-5 h-5 text-atlas-text-medium" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Sidebar Content */}
                  <QuickActions onViewHistory={handleViewHistory} />
                  <UsageCounter userId={userId ?? ''} />
                  <InsightsWidget />
                  
                  {/* Rituals Button */}
                  <button
                    onClick={() => {
                      navigate('/rituals');
                      setSidebarOpen(false); // Close sidebar after navigation
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-atlas-text-medium bg-atlas-button hover:bg-atlas-button-hover transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-atlas-accent-1/30 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-atlas-accent-1" />
                    </div>
                    <div className="text-left flex-1">
                      <span className="font-medium text-sm">Rituals</span>
                      <p className="text-atlas-text-muted text-xs">Mindfulness & Focus</p>
                    </div>
                  </button>
                  
                  <PrivacyToggle />
                  
                  {/* Divider */}
                  <div className="my-4 border-t border-atlas-border/50"></div>
                  
                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-atlas-text-medium bg-atlas-button hover:bg-atlas-button-hover transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-atlas-accent-2/30 flex items-center justify-center">
                      <LogOut className="w-4 h-4 text-atlas-accent-3" />
                    </div>
                    <div className="text-left flex-1">
                      <span className="font-medium text-sm">Sign Out</span>
                      <p className="text-atlas-text-muted text-xs">End your session</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ✅ WCAG AA: Skip link for keyboard navigation */}
        <a 
          href="#main-chat"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-atlas-accent-2 focus:text-white focus:rounded-lg focus:shadow-lg"
        >
          Skip to main chat
        </a>

        {/* Chat Container - ✅ WCAG AA: Semantic <main> landmark */}
        <main 
          id="main-chat"
          className="flex flex-col h-[calc(100vh-120px)] sm:h-[calc(100vh-80px)]"
          aria-label="Chat conversation"
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
            className="flex-1 overflow-y-auto px-4 py-6 pt-4 pb-32 bg-white"
            role="log"
            aria-live="polite"
            aria-label="Message list"
            onScroll={() => {
              // 📱 Dismiss keyboard when scrolling (ChatGPT-like behavior)
              if (inputRef.current) {
                inputRef.current.blur();
              }
            }}
          >
            <div className="max-w-4xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              <MessageListWithPreviews>
                {(() => {
                  const safeMessages = messages || [];
                  // Debug logging removed - messages rendering correctly
                  if (safeMessages.length > 0) {
                    return (
                      <>
                        {safeMessages.map((message: Message, index: number) => {
                          // Find the last user message index
                          const lastUserMessageIndex = safeMessages
                            .map((m, i) => m.role === 'user' ? i : -1)
                            .filter(i => i !== -1)
                            .pop();
                          
                          const isLatestUserMessage = message.role === 'user' && index === lastUserMessageIndex;
                          
                          return (
                            <EnhancedMessageBubble
                              key={message.id}
                              message={message}
                              isLatest={index === safeMessages.length - 1}
                              isLatestUserMessage={isLatestUserMessage}
                              isTyping={false}
                              onDelete={handleDeleteMessage}
                              onEdit={handleEditMessage}
                            />
                          );
                        })}
                        
        {/* ✅ Typing indicator - always rendered to prevent layout shift */}
        <div className="min-h-[60px] flex items-end">
          <div 
            className="flex justify-start mb-4"
            style={{ 
              display: isStreaming && messages.some(m => m.role === 'user') ? 'block' : 'none'
            }}
          >
            <div className="flex items-center space-x-3 px-4 py-3">
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
              </div>
            </div>
          </div>
        </div>
                        
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

          {/* Footer - No background, fully transparent */}
          <div 
            className={`fixed bottom-0 left-0 right-0 p-4 z-30`}
            style={{ 
              paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
              background: 'transparent',
              borderTop: 'none',
              backgroundColor: 'transparent'
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
          </div>
        </main>

        {/* Modern scroll-to-bottom button with golden sparkle */}
        <ScrollToBottomButton
          onClick={scrollToBottom}
          visible={showScrollButton}
          shouldGlow={shouldGlow}
        />

        {/* ✅ Use VoiceUpgradeModal for ALL upgrade scenarios (consistent warm UI) */}
        <VoiceUpgradeModal
          isOpen={genericModalVisible}
          onClose={hideGenericUpgrade}
          feature={genericModalFeature === 'audio' ? 'audio' : genericModalFeature === 'image' ? 'image' : 'voice_calls'}
          defaultTier={genericModalFeature === 'audio' || genericModalFeature === 'image' ? 'core' : 'studio'}
        />


        {/* Conversation History Modal - Rendered at page level for proper mobile centering */}
        {historyData && (
          <ConversationHistoryDrawer
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
            conversations={historyData.conversations}
            onDeleteConversation={historyData.onDeleteConversation}
            deletingId={historyData.deletingId}
            onRefresh={historyData.onRefresh}
          />
        )}

        {/* Search Drawer - PHASE 2B */}
        {userId && (
          <SearchDrawer
            isOpen={showSearch}
            onClose={() => setShowSearch(false)}
            userId={userId}
            currentConversationId={conversationId || undefined}
            onNavigateToMessage={handleNavigateToMessage}
          />
        )}

        {/* Profile Settings Modal */}
        <ProfileSettingsModal
          isOpen={showProfile}
          onClose={() => setShowProfile(false)}
          onSignOut={handleLogout}
        />
        
      </div>
    </ErrorBoundary>
  );
};

export default ChatPage;