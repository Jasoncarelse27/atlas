import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import EnhancedUpgradeModal from '../components/EnhancedUpgradeModal';
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
  user?: any;
}

const ChatPage: React.FC<ChatPageProps> = () => {
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
  } | null>(null);
  
  // Search modal state
  const [showSearch, setShowSearch] = useState(false);
  
  // Removed duplicate useMessageStore - using usePersistentMessages as single source of truth
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Memory integration
  useMemoryIntegration({ userId: userId || undefined });

  // 🔥 Modern tier management with React Query + Realtime
  const { tier } = useTierQuery();

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
        logger.debug('[ChatPage] ⚠️ userId not available yet, skipping message load');
        return;
      }
      
      // ✅ MOBILE FIX: Ensure database is ready before use
      await ensureDatabaseReady();
      
      // ✅ SECURITY FIX: Always filter by userId to prevent cross-user data exposure
      let storedMessages = await atlasDB.messages
        .where("conversationId")
        .equals(conversationId)
        .and(msg => msg.userId === userId && !msg.deletedAt) // ✅ CRITICAL: Filter by userId AND exclude deleted
        .sortBy("timestamp");
      
      // ✅ NOTE: Removed fallback without userId filter for security
      // If no messages found, fetch from Supabase instead (see below)
      
      // ✅ NEW: If Dexie is still empty, fetch from Supabase and sync to Dexie
      if (storedMessages.length === 0) {
        logger.debug('[ChatPage] 🔄 Dexie empty, fetching from Supabase...');
        
        const { data: supabaseMessages } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at');
        
        if (supabaseMessages && supabaseMessages.length > 0) {
          logger.debug('[ChatPage] ✅ Found', supabaseMessages.length, 'messages in Supabase, syncing to Dexie...');
          
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
              attachments: msg.attachments || undefined, // ✅ Save attachments
              deletedAt: msg.deleted_at || undefined, // ✅ PHASE 2: Sync deleted status
              deletedBy: msg.deleted_by || undefined  // ✅ PHASE 2: Sync deleted type
            }))
          );
          
          // Reload from Dexie (with deleted filter)
          storedMessages = await atlasDB.messages
            .where("conversationId")
            .equals(conversationId)
            .and(msg => !msg.deletedAt) // ✅ Exclude deleted messages
            .sortBy("timestamp");
          
          logger.debug('[ChatPage] ✅ Synced', supabaseMessages.length, 'messages from Supabase to Dexie');
        } else {
          logger.debug('[ChatPage] ℹ️ No messages found in Supabase for conversation:', conversationId);
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
        logger.debug('[ChatPage] 🔍 Loading image messages from Dexie:', imageMessages.map(msg => ({
          id: msg.id,
          type: msg.type,
          url: msg.url,
          imageUrl: msg.imageUrl,
          hasAttachments: !!msg.attachments
        })));
      }
      
      // Set React state (Dexie is authoritative source)
      setMessages(formattedMessages);
      logger.debug('[ChatPage] ✅ Loaded', formattedMessages.length, 'messages from Dexie');
    } catch (error) {
      logger.error('[ChatPage] ❌ Failed to load messages:', error);
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
      alert('Please wait for authentication to complete before sending messages.');
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
      const optimisticUserMessage: Message = {
        id: `temp-${Date.now()}`, // Temporary ID
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        type: 'text',
        status: 'sending' // ✅ NEW: Show sending status
      };
      
      // Add to UI instantly for ChatGPT-like experience
      setMessages(prev => [...prev, optimisticUserMessage]);
      logger.debug('[ChatPage] ✅ Optimistic user message displayed:', optimisticUserMessage.id);
      
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
      
      logger.debug('[ChatPage] ✅ Message sent to backend, waiting for real-time updates...');
      
      // ✅ AUTO TITLE GENERATION: Generate title for first user message
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
      }
      
      // ✅ OPTIMIZED FALLBACK: Reduced timer for faster response (500ms)
      fallbackTimerRef.current = setTimeout(async () => {
        logger.warn('[ChatPage] ⚠️ Real-time event not received, using fast fallback reload');
        setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
        await loadMessages(conversationId);
      }, 1000); // ✅ Balanced timing for stable real-time sync
      
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
      alert('Failed to delete message. Please try again.');
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
            attachments: newMsg.attachments || undefined, // ✅ Save attachments array
            deletedAt: newMsg.deleted_at || undefined, // ✅ PHASE 2: Sync deleted status
            deletedBy: newMsg.deleted_by || undefined  // ✅ PHASE 2: Sync deleted type
          };
          
          logger.debug('[ChatPage] 🔔 Saving to Dexie:', {
            id: messageToSave.id,
            type: messageToSave.type,
            hasImageUrl: !!messageToSave.imageUrl,
            hasImage_url: !!messageToSave.image_url,
            hasAttachments: !!messageToSave.attachments
          });
          
          await atlasDB.messages.put(messageToSave as any);
          
          logger.debug('[ChatPage] ✅ Message written to Dexie:', newMsg.id);
          
          // ✅ OPTIMISTIC UPDATE: Replace temporary message with real one
          if (newMsg.role === 'user') {
            setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
            logger.debug('[ChatPage] ✅ Removed optimistic message, real message from Dexie will replace it');
          }
          
          // ✅ Reload messages from Dexie (single source of truth)
          await loadMessages(conversationId);

          // ✅ NEW: Mark user messages as 'sent' when saved to database
          if (newMsg.role === 'user') {
            setMessages(prev => prev.map(m => 
              m.id === newMsg.id ? { ...m, status: 'sent' as const } : m
            ));
            logger.debug('[ChatPage] ✅ Marked message as sent:', newMsg.id);
          }
          
          // Only reset indicators for assistant messages
          if (newMsg.role === 'assistant') {
            setIsStreaming(false);
            setIsTyping(false);
            logger.debug('[ChatPage] ✅ Reset typing indicators after assistant response');
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
          await conversationSyncService.deltaSync(userId);
          
          // ✅ ADD THIS LINE: Sync conversations from Supabase to local Dexie
          await conversationSyncService.syncConversationsFromRemote(userId);
          
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
  }, [conversationId, loadMessages, userId]); // Keep userId in deps for loadMessages calls

  // ✅ MOBILE FIX: Load messages when userId becomes available
  useEffect(() => {
    if (userId && conversationId) {
      logger.debug('[ChatPage] 🔄 userId available, loading messages for conversation:', conversationId);
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
      <div className="min-h-screen bg-white">
        {/* Header Skeleton */}
        <div className="bg-white/50 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-30">
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
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
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
              onClick={() => window.location.reload()}
              className="w-full py-3 px-6 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-yellow-500/50"
            >
              Reload Atlas Now
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
      <div className="min-h-screen bg-white text-gray-900">
        {/* Header with Menu Button */}
        <div className="bg-white/50 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-30">
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
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Atlas AI</h1>
                  <p className="text-gray-600 text-sm sm:text-base hidden sm:block">Your emotionally intelligent AI assistant</p>
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
                className="fixed left-0 top-0 h-full w-80 bg-[#F9F6F3] border-r border-[#E8DDD2] z-50 overflow-y-auto shadow-xl"
              >
                <div className="p-4 space-y-6">
                  {/* Header with Profile and Close Buttons */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[#3B3632]">Menu</h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowProfile(true)}
                        className="p-2 rounded-xl bg-[#F0E6DC] hover:bg-[#E8DDD2] transition-colors"
                        aria-label="Open profile settings"
                        title="Profile Settings"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B2BDA3] to-[#F4E5D9] flex items-center justify-center text-sm font-semibold text-gray-900">
                          {userEmail?.[0]?.toUpperCase() || '?'}
                        </div>
                      </button>
                      <button
                        onClick={() => setSidebarOpen(false)}
                        className="p-2 rounded-xl bg-[#F0E6DC] hover:bg-[#E8DDD2] transition-colors"
                        aria-label="Close menu"
                      >
                        <X className="w-5 h-5 text-[#5A524A]" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Sidebar Content */}
                  <QuickActions onViewHistory={handleViewHistory} />
                  <UsageCounter userId={userId ?? ''} />
                  <InsightsWidget />
                  <PrivacyToggle />
                  
                  {/* Divider */}
                  <div className="my-4 border-t border-[#E8DDD2]/50"></div>
                  
                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#5A524A] bg-[#F0E6DC] hover:bg-[#E8DDD2] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#CF9A96]/30 flex items-center justify-center">
                      <LogOut className="w-4 h-4 text-[#A67571]" />
                    </div>
                    <div className="text-left flex-1">
                      <span className="font-medium text-sm">Sign Out</span>
                      <p className="text-[#8B7E74] text-xs">End your session</p>
                    </div>
                  </button>
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
            className="flex-1 overflow-y-auto px-4 py-6 pt-4 pb-32"
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
                            onDelete={handleDeleteMessage}
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
            <div className="flex items-center space-x-3 px-4 py-3">
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
            className="fixed bottom-0 left-0 right-0 p-4 z-30"
            style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
            initial={{ y: 0 }}
            animate={{ y: 0 }}
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

        {/* Upgrade Modals */}
        <EnhancedUpgradeModal
          isOpen={isGenericModalOpen}
          onClose={closeGenericModal}
          feature={genericModalFeature || upgradeReason}
          currentUsage={currentUsage}
          limit={limit}
        />

        <VoiceUpgradeModal
          isOpen={voiceModalVisible}
          onClose={hideVoiceUpgrade}
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