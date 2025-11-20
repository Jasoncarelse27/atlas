import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, Search, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useThemeMode } from '../hooks/useThemeMode'; // ✅ Theme support
import { useTierQuery } from '../hooks/useTierQuery'; // 🔥 Use modern tier hook
import { logger } from '../lib/logger';
import { checkSupabaseHealth, supabase } from '../lib/supabaseClient';
import { chatService } from '../services/chatService';
import { databaseMigration } from '../services/databaseMigration';
import { startBackgroundSync, stopBackgroundSync } from '../services/syncService';
import { autoGenerateTitle } from '../services/titleGenerationService';
import type { Message } from '../types/chat';
import { getApiEndpoint } from '../utils/apiClient';
import { generateUUID } from '../utils/uuid';

// Sidebar components
import { ConversationHistoryDrawer } from '../components/ConversationHistoryDrawer';
import { MailerLiteIntegration } from '../components/MailerLiteIntegration';
import { NotificationCenter } from '../components/NotificationCenter';
import { PWAInstallPrompt } from '../components/PWAInstallPrompt'; // ✅ PWA: Install prompt for mobile users
import { SearchDrawer } from '../components/SearchDrawer';
import { UserQuestionnaire } from '../components/onboarding/UserQuestionnaire';
import { EmotionalInsightsWidgets } from '../components/sidebar/EmotionalInsightsWidgets';
import PrivacyToggle from '../components/sidebar/PrivacyToggle';
import QuickActions from '../components/sidebar/QuickActions';
import UsageCounter from '../components/sidebar/UsageCounter';
import { useAndroidBackButton } from '../hooks/useAndroidBackButton'; // ✅ ANDROID: Back button handling
import { useAndroidKeyboard } from '../hooks/useAndroidKeyboard'; // ✅ ANDROID: Keyboard handling
import { useMailerEvents } from '../hooks/useMailer';
import { useMailerAutomation } from '../hooks/useMailerAutomation';
import { useMobileOptimization } from '../hooks/useMobileOptimization'; // ✅ UX IMPROVEMENT: Mobile optimization for pull-to-refresh
import { useRealtimeConversations } from '../hooks/useRealtimeConversations';
import { useTierRefreshOnFocus } from '../hooks/useTierRefreshOnFocus';
import { useTutorial } from '../hooks/useTutorial';

interface ChatPageProps {
  user?: { id: string; email?: string };
}

const ChatPage: React.FC<ChatPageProps> = () => {
  // ✅ CRITICAL FIX: Initialize ALL hooks unconditionally at the top level
  // Router hooks first (most stable, no dependencies)
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Context hooks next (depend on providers, but providers are guaranteed by App.tsx)
  const {
    voiceModalVisible,
    hideVoiceUpgrade,
    genericModalVisible,
    hideGenericUpgrade,
    genericModalFeature,
    showGenericUpgrade,
  } = useUpgradeModals();
  
  // State hooks (must be before any hooks that might depend on state)
  const [healthError, setHealthError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [hasCheckedQuestionnaire, setHasCheckedQuestionnaire] = useState(false);
  
  // Custom hooks (may depend on router/context/state)
  // ✅ ANDROID BEST PRACTICE: Handle back button and keyboard
  // Note: useAndroidBackButton internally calls useNavigate/useLocation - that's fine, React handles it
  useAndroidBackButton();
  const { isOpen: keyboardOpen, height: keyboardHeight } = useAndroidKeyboard();
  const { isMobile, triggerHaptic } = useMobileOptimization();
  
  // React Query hooks (must be AFTER all other hooks to prevent initialization order issues)
  // 🔥 Modern tier management with React Query + Realtime
  const { tier, refreshTier } = useTierQuery();
  
  // ✅ TYPESCRIPT FIX: Use proper Conversation type instead of any[]
  interface HistoryModalData {
    conversations: Array<{
      id: string;
      title: string;
      createdAt: string;
      updatedAt: string;
      userId?: string;
    }>;
    onDeleteConversation: (id: string) => void;
    deletingId: string | null;
    onRefresh?: () => Promise<void>;
  }
  const [historyData, setHistoryData] = useState<HistoryModalData | null>(null);
  
  // Search modal state
  const [showSearch, setShowSearch] = useState(false);
  
  // Removed duplicate useMessageStore - using usePersistentMessages as single source of truth
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ✅ CRITICAL FIX: Declare refs BEFORE they're used in useEffect
  const isProcessingRef = useRef(false);
  const lastMessageRef = useRef<string>('');
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Memory integration
  useMemoryIntegration({ userId: userId || undefined });
  
  // ✅ Tier refresh on focus/visibility (cross-device sync)
  useTierRefreshOnFocus();
  
  // ✅ Daily conversation tracking for MailerLite integration
  const { data: dailyUsage } = useQuery({
    queryKey: ['dailyUsage', userId, new Date().toISOString().split('T')[0]],
    queryFn: async () => {
      if (!userId) return 0;
      
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_usage')
        .select('conversations_count')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();
      
      if (error) {
        logger.debug('[ChatPage] Error fetching daily usage:', error);
        return 0;
      }
      
      return data?.conversations_count || 0;
    },
    enabled: !!userId,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider stale after 30 seconds
  });
  
  // ✅ Silent MailerLite automation for all authenticated users (no UI)
  useMailerAutomation({
    userEmail: userEmail || '',
    userName: userName,
    userTier: tier || 'free',
    conversationsToday: dailyUsage || 0,
    totalConversations: messages.length,
  });
  
  // ✅ Theme support
  const { isDarkMode } = useThemeMode();

  // ✅ ENTERPRISE: Real-time conversation deletion listener (clean, reliable)
  useRealtimeConversations(userId || undefined);

  // ✅ PHASE 2: Messages state - only updated by loadMessages (from Dexie)
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  
  // ✅ UX IMPROVEMENT: Pull-to-refresh state (mobile)
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastRefreshTimeRef = useRef<number>(0);
  const touchStartTimeRef = useRef<number>(0);
  
  // ✅ CRITICAL FIX: Declare ref BEFORE useAutoScroll hook (dependency)
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // ✅ CRITICAL FIX: Move useAutoScroll to top (BEFORE useCallbacks/useEffects)
  // This MUST be called before any conditional logic or effects to prevent hook order violations
  const { bottomRef, scrollToBottom, showScrollButton, shouldGlow } = useAutoScroll([messages.length], messagesContainerRef);

  // ✅ CRITICAL FIX: Move useTutorial to top (BEFORE useCallbacks/useEffects)
  // This MUST be called before any conditional logic or effects to prevent hook order violations
  const { startTutorial, isCompleted, isLoading: tutorialLoading } = useTutorial();
  
  // ✅ Add message function for image uploads
  // ✅ CRITICAL FIX: Maintain chronological order when adding messages
  const addMessage = useCallback((message: Message) => {
    setMessages(prev => {
      const newMessages = [...prev, message];
      // Sort by timestamp to maintain chronological order
      newMessages.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB; // Ascending order (oldest first)
      });
      return newMessages;
    });
  }, []);
  
  // ✅ OPTIMIZATION: Session-scoped cache to prevent redundant message loads (5s window)
  const messageLoadCache = useRef(new Map<string, { timestamp: number; promise: Promise<Message[]> }>()).current;
  
  // ✅ SCALABILITY: Load older messages (pagination support)
  const loadOlderMessages = useCallback(async (conversationId: string, currentOldestTimestamp: string) => {
    setIsLoadingOlderMessages(prev => {
      if (prev) return prev; // Already loading
      return true;
    });
    
    try {
      await ensureDatabaseReady();
      
      // Load 50 messages older than the current oldest message
      // Use sortBy then filter/limit in JavaScript (Dexie pattern)
      let olderMessages = await atlasDB.messages
        .where("conversationId")
        .equals(conversationId)
        .filter(msg => !msg.deletedAt && msg.timestamp < currentOldestTimestamp)
        .sortBy("timestamp");
      
      // ✅ CRITICAL FIX: Ensure messages are sorted chronologically (oldest first)
      olderMessages.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB; // Ascending order (oldest first)
      });
      
      // Take last 50 messages (most recent of the older ones) - but keep chronological order
      olderMessages = olderMessages.slice(-50);
      
      if (olderMessages.length > 0) {
        const formattedOlder = olderMessages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          type: msg.type || 'text',
          // ✅ CRITICAL FIX: Deduplicate attachments by URL
          attachments: Array.isArray(msg.attachments)
            ? msg.attachments.filter(
                (att, index, self) => index === self.findIndex(a => a.url === att.url)
              )
            : []
        } as Message));
        
        // ✅ CRITICAL FIX: Prepend older messages to the top (already in chronological order)
        setMessages(prev => [...formattedOlder, ...prev]);
        
        // Check if there are more messages to load
        const hasMore = olderMessages.length === 50;
        setHasMoreMessages(hasMore);
        
        logger.debug('[ChatPage] ✅ Loaded', olderMessages.length, 'older messages');
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      logger.error('[ChatPage] ❌ Failed to load older messages:', error);
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, []);
  
  // ✅ PHASE 2: Load messages from Dexie (read-only, single source of truth)
  // ✅ CRITICAL FIX: Declare loadMessages BEFORE useEffect that uses it
  // ✅ SCALABILITY: Limit initial load to last 100 messages
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
      
      // ✅ SCALABILITY: Load only last 100 messages (chronological order: oldest first)
      // ✅ CRITICAL FIX: Always sort by timestamp ascending for consistent ordering
      let storedMessages = await atlasDB.messages
        .where("conversationId")
        .equals(conversationId)
        .filter(msg => !msg.deletedAt)
        .sortBy("timestamp");
      
      // ✅ CRITICAL FIX: Ensure messages are sorted chronologically (oldest first)
      // This ensures consistent ordering across web and mobile
      storedMessages.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB; // Ascending order (oldest first)
      });
      
      // Take last 100 messages (most recent) - but keep them in chronological order
      storedMessages = storedMessages.slice(-100);
      
      // ✅ SCALABILITY: Check if there are more messages to load
      const totalCount = await atlasDB.messages
        .where("conversationId")
        .equals(conversationId)
        .filter(msg => !msg.deletedAt)
        .count();
      
      setHasMoreMessages(totalCount > storedMessages.length);
      
      logger.debug('[ChatPage] 🔍 Loaded messages for conversation:', {
        conversationId,
        count: storedMessages.length,
        totalCount,
        hasMore: totalCount > storedMessages.length,
        loadTime: `${(performance.now() - startTime).toFixed(0)}ms`,
        firstTimestamp: storedMessages[0]?.timestamp,
        lastTimestamp: storedMessages[storedMessages.length - 1]?.timestamp,
        userMessages: storedMessages.filter(m => m.role === 'user').length,
        assistantMessages: storedMessages.filter(m => m.role === 'assistant').length,
        unsyncedMessages: storedMessages.filter(m => !m.synced).length
      });
      
      const formattedMessages = storedMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        type: msg.type || 'text',
        // ✅ CRITICAL FIX: Deduplicate attachments by URL
        attachments: Array.isArray(msg.attachments)
          ? msg.attachments.filter(
              (att, index, self) => index === self.findIndex(a => a.url === att.url)
            )
          : []
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
      setHasMoreMessages(false);
    }
  }, [userId, conversationId]); // ✅ MOBILE FIX: Add userId dependency to ensure proper filtering

  // ✅ CRITICAL FIX: Listen for new messages from real-time (mobile-safe)
  useEffect(() => {
    if (!conversationId || typeof window === 'undefined') return;

    const handleNewMessage = async (event: CustomEvent) => {
      const { message, conversationId: msgConversationId } = event.detail;
      
      logger.debug('[ChatPage] 📨 New message received via real-time:', {
        id: message.id,
        role: message.role,
        messageConversationId: msgConversationId,
        currentConversationId: conversationId,
        isForCurrentConversation: msgConversationId === conversationId,
        isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      });
      
      // ✅ CRITICAL FIX: Only handle messages for current conversation
      // Messages for other conversations are already saved to Dexie by useRealtimeConversations hook
      if (msgConversationId !== conversationId) {
        logger.debug('[ChatPage] ⏭️ Message is for different conversation, skipping UI update:', {
          messageConversationId: msgConversationId,
          currentConversationId: conversationId
        });
        return;
      }
      
      // Clear fallback timer if it exists
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      
      // ✅ MOBILE SAFETY: Use requestAnimationFrame to ensure UI updates even if page was backgrounded
      requestAnimationFrame(async () => {
        try {
          // ✅ CRITICAL FIX: Reload messages from Dexie (useRealtimeConversations already saved it)
          // This ensures we get the latest message that was just saved
          await loadMessages(conversationId);
          
          // ✅ CRITICAL FIX: Force UI update on mobile (sometimes React doesn't detect state change)
          const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          if (isMobile) {
            // Force re-render by updating messages state
            const updatedMessages = await atlasDB.messages
              .where("conversationId")
              .equals(conversationId)
              .filter(msg => !msg.deletedAt)
              .sortBy("timestamp");
            
            const formatted = updatedMessages.slice(-100).map(msg => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
              type: msg.type || 'text',
              // ✅ CRITICAL FIX: Deduplicate attachments by URL
              attachments: Array.isArray(msg.attachments)
                ? msg.attachments.filter(
                    (att, index, self) => index === self.findIndex(a => a.url === att.url)
                  )
                : []
            } as Message));
            
            setMessages(formatted);
            logger.debug('[ChatPage] ✅ Mobile: Force-updated messages after real-time event');
          }
          
          // Clear typing/streaming indicators
          setIsTyping(false);
          setIsStreaming(false);
          isProcessingRef.current = false;
          
          logger.debug('[ChatPage] ✅ UI updated with new message from real-time');
        } catch (error) {
          logger.error('[ChatPage] ❌ Error handling new message:', error);
        }
      });
    };
    
    window.addEventListener('newMessageReceived', handleNewMessage as EventListener);
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('newMessageReceived', handleNewMessage as EventListener);
      }
    };
  }, [conversationId, loadMessages]);

  // ✅ CRITICAL FIX: Reload messages when page becomes visible on mobile (cross-device sync)
  useEffect(() => {
    if (!conversationId || typeof document === 'undefined') return;
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          logger.debug('[ChatPage] 📱 Page visible on mobile, reloading messages for sync...');
          await loadMessages(conversationId);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [conversationId, loadMessages]);

  // Handle history modal from QuickActions
  // ✅ TYPESCRIPT FIX: Use proper type instead of any[]
  const handleViewHistory = (data: HistoryModalData) => {
    setHistoryData(data);
    setShowHistory(true);
    setSidebarOpen(false); // ✅ Close main sidebar when opening history
  };

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
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, []); // Run once on mount

  // Simple logout function
  const handleLogout = async () => {
    try {
      const supabase = (await import('../lib/supabase')).default;
      await supabase.auth.signOut();
      // ✅ FIX: Use React Router navigation instead of hard reload
      navigate('/login', { replace: true });
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
  
  // ✅ OPTIMISTIC UPDATES: Show user message instantly for ChatGPT-like experience
  // ✅ PERFORMANCE FIX: Memoize callback to prevent EnhancedInputToolbar re-renders
  const handleTextMessage = useCallback(async (text: string) => {
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
    
    // ✅ FIX: Trigger first message event (persistent across remounts using localStorage)
    if (userId && userEmail && messages.length === 0) {
      const firstMessageKey = `atlas:first_message_${userId}`;
      const hasTriggered = typeof window !== 'undefined' && localStorage.getItem(firstMessageKey) === 'true';
      
      if (!hasTriggered) {
        triggerMailerLiteEvent('first_message', {
          tier: tier || 'free',
          timestamp: new Date().toISOString(),
        }).then(() => {
          // Mark as triggered in localStorage (persists across remounts)
          if (typeof window !== 'undefined') {
            localStorage.setItem(firstMessageKey, 'true');
          }
        }).catch(error => {
          logger.debug('[ChatPage] MailerLite first message event failed (non-critical):', error);
        });
      }
    }
    
    // ✅ SECURITY: Validate message length (prevent abuse, protect API costs) - Tier-aware
    // Aligned with token monitoring system: ~4 characters per token
    // Limits based on maxTokensPerResponse × multiplier for good UX
    const TIER_LIMITS: Record<string, number> = {
      free: 2000,    // ~500 tokens (maxTokensPerResponse: 100 × 5) - Protects $0/month margin
      core: 4000,    // ~1000 tokens (maxTokensPerResponse: 250 × 4) - Protects $19.99/month margin
      studio: 8000,  // ~2000 tokens (maxTokensPerResponse: 400 × 5) - Protects $149.99/month margin
    };
    const maxLength = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const trimmedText = text.trim();
    if (trimmedText && trimmedText.length > maxLength) {
      toast.error(`Message too long (${trimmedText.length.toLocaleString()} characters). Maximum is ${maxLength.toLocaleString()} characters for your ${tier} tier.`);
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
    
    // ✅ CRITICAL FIX: Ensure auth token is valid before sending
    try {
      const { getAuthToken } = await import('@/utils/getAuthToken');
      const token = await getAuthToken(true); // Force refresh if needed
      
      if (!token) {
        logger.error('[ChatPage] ❌ No valid auth token - session expired');
        toast.error('Session expired. Please refresh the page or sign in again.');
        // ✅ FIX: Use React Router navigation instead of hard reload
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
        return;
      }
    } catch (authError) {
      logger.error('[ChatPage] ❌ Auth check failed:', authError);
      toast.error('Authentication error. Please refresh the page.');
      return;
    }
    
    lastMessageRef.current = trimmedText;
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
      // ✅ DEBUG: Log before sending to catch any immediate errors
      logger.error('[ChatPage] 🚀 About to call chatService.sendMessage', {
        text: text.substring(0, 50),
        conversationId,
        userId
      });
      
      await chatService.sendMessage(
        text, 
        () => {}, // No frontend status updates needed
        conversationId, 
        userId
      );
      
      // ✅ TIER SYNC: Refresh tier after successful message send
      // Ensures tier is up-to-date (especially after upgrades or hitting limits)
      refreshTier().catch((err) => {
        // Silent fail - non-critical, tier will refresh on next focus/visibility change
        logger.debug('[ChatPage] Tier refresh after message send failed (non-critical):', err);
      });
      
      // ✅ BEST PRACTICE: Usage counter now updates automatically via Supabase Realtime
      // No need for custom events - Realtime subscription in UsageCounter listens to INSERT events
      // This provides instant cross-device sync (mobile ↔ web) automatically
      
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
      
      // ✅ BULLETPROOF FALLBACK: If realtime fails, fetch directly from Supabase (mobile-safe)
      // ✅ MOBILE FIX: Increased timeout to 3s for slower mobile connections
      const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const fallbackDelay = isMobile ? 3000 : 2000; // 3s on mobile, 2s on desktop
      
      fallbackTimerRef.current = setTimeout(async () => {
        logger.warn(`[ChatPage] ⚠️ Real-time not received after ${fallbackDelay}ms${isMobile ? ' (Mobile)' : ''}, fetching from Supabase`);
        
        // ✅ MOBILE SAFETY: Check if timer was cleared (real-time might have worked)
        // Note: We can't check fallbackTimerRef.current here because setTimeout already fired
        // But we can check if messages were already loaded
        
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
          // ✅ TYPESCRIPT FIX: Use proper SupabaseMessage type instead of any
          interface SupabaseMessage {
            id: string;
            conversation_id: string;
            user_id: string;
            role: 'user' | 'assistant' | 'system';
            content: string;
            created_at: string;
            attachments?: Array<{ type: string; url: string }>;
            deleted_at?: string;
            deleted_by?: 'user' | 'everyone';
          }
          await atlasDB.messages.bulkPut(
            latestMessages.map((msg: SupabaseMessage) => ({
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
        isProcessingRef.current = false;
      }, fallbackDelay); // ✅ Mobile-safe fallback delay
      
      // Keep typing indicator active until real-time listener receives response
      
    } catch (error) {
      // ✅ IMPROVED: Log full error details for debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('[ChatPage] ❌ Failed to send message:', {
        error: errorMessage,
        name: errorName,
        stack: errorStack,
        fullError: error
      });
      
      // ✅ Clear fallback timer on error
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      
      // ✅ ROLLBACK: Remove optimistic message on error (remove the last user message that failed)
      setMessages(prev => {
        // Find and remove the last user message with 'sending' status (the one that just failed)
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].role === 'user' && prev[i].status === 'sending') {
            return prev.filter((_, index) => index !== i);
          }
        }
        return prev;
      });
      logger.debug('[ChatPage] ⚠️ Rolled back optimistic message due to error:', errorMessage);
      
      setIsTyping(false);
      setIsStreaming(false);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          // User cancelled - this is expected, don't show error
          logger.info('[ChatPage] ✅ User cancelled message generation');
          return;
        }
        
        // ✅ FIX: Check for monthly limit error (multiple formats)
        const errorLower = error.message.toLowerCase();
        const errorCode = (error as any)?.code || (error as any)?.error || '';
        const isMonthlyLimit = errorLower.includes('monthly limit') || 
            errorLower.includes('monthly_limit') ||
            error.message === 'MONTHLY_LIMIT_REACHED' ||
            errorCode === 'MONTHLY_LIMIT_REACHED' ||
            errorLower.includes('monthly limit reached');
        
        // ✅ COOLDOWN: Check for Core tier cooldown limit
        const isCooldownLimit = errorLower.includes('cooldown') ||
            errorCode === 'COOLDOWN_LIMIT_REACHED' ||
            error.message === 'COOLDOWN_LIMIT_REACHED';
            
        if (isMonthlyLimit) {
          logger.warn('[ChatPage] ⚠️ Monthly limit reached - showing upgrade modal');
          
          // ✅ MailerLite: Trigger monthly limit event
          if (userEmail) {
            triggerMailerLiteEvent('monthly_limit_reached', {
              tier: tier || 'free',
              limit: 15,
              timestamp: new Date().toISOString(),
            }).catch(error => {
              logger.debug('[ChatPage] MailerLite event trigger failed (non-critical):', error);
            });
          }
          
          // ✅ CRITICAL: Show toast notification immediately (synchronous, no setTimeout)
          try {
            toast.error('Monthly message limit reached. Upgrade to continue!', {
              duration: 5000,
              icon: '⚠️'
            });
            logger.debug('[ChatPage] ✅ Toast shown for monthly limit');
          } catch (toastError) {
            logger.error('[ChatPage] Failed to show toast:', toastError);
            // Fallback: Use alert if toast fails
            alert('Monthly message limit reached. Please upgrade to continue.');
          }
          
          // Show upgrade modal immediately
          setCurrentUsage(15);
          setLimit(15);
          setUpgradeReason('monthly message limit');
          setUpgradeModalVisible(true);
        } else if (isCooldownLimit) {
          // ✅ COOLDOWN: Handle Core tier cooldown with friendly message
          const cooldownData = (error as any)?.minutesUntilUnlock || 240;
          const hours = Math.floor(cooldownData / 60);
          const minutes = cooldownData % 60;
          
          logger.warn('[ChatPage] ⚠️ Cooldown limit reached - showing friendly message');
          
          try {
            toast.error(`Taking a breath 🌙\n\nYou've had a busy conversation session! More messages unlock in ${hours}h ${minutes}m.`, {
              duration: 8000,
              icon: '⏱️'
            });
          } catch (toastError) {
            logger.error('[ChatPage] Failed to show toast:', toastError);
          }
          
          // Show upgrade modal with Studio upgrade option
          setUpgradeReason('cooldown limit');
          setUpgradeModalVisible(true);
          
          // Also trigger context modal for consistency
          try {
            showGenericUpgrade('monthly_limit');
            logger.debug('[ChatPage] ✅ Upgrade modal triggered');
          } catch (modalError) {
            logger.error('[ChatPage] Failed to show upgrade modal:', modalError);
          }
          return;
        }
        
        // ✅ FIX: Check for daily limit error
        if (errorLower.includes('daily limit') || 
            errorLower.includes('daily_limit') ||
            error.message === 'DAILY_LIMIT_REACHED') {
          logger.warn('[ChatPage] ⚠️ Daily limit reached - showing upgrade modal');
          toast.error('Daily message limit reached. Upgrade to continue!', {
            duration: 5000,
            icon: '⚠️'
          });
          showGenericUpgrade('daily_limit');
          return;
        }
        
        // ✅ FIX: Generic error feedback
        const errorMessage = error.message || 'Failed to send message';
        toast.error(errorMessage.includes('Backend error:') 
          ? errorMessage.replace('Backend error: ', '') 
          : errorMessage, {
          duration: 5000
        });
      }
    } finally {
      isProcessingRef.current = false;
      
      // Clear duplicate check after 1 second
      setTimeout(() => {
        lastMessageRef.current = '';
      }, 1000);
    }
  }, [tier, conversationId, userId, messages.length, navigate, addMessage, refreshTier]); // ✅ PERFORMANCE FIX: Memoize with dependencies

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

  // ✅ REMOVED: Edit message handler - edit functionality removed per user request

  // ✅ PHASE 2B: Navigate to message from search
  const handleNavigateToMessage = async (targetConversationId: string, messageId: string) => {
    try {
      logger.debug('[ChatPage] 🔍 Navigating to message:', { targetConversationId, messageId });

      // ✅ FIX: Update URL first to prevent URL effect from overriding
      if (targetConversationId !== conversationId) {
        navigate(`/chat?conversation=${targetConversationId}`, { replace: true });
        setConversationId(targetConversationId);
        // Small delay to let URL effect process the change
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Always load messages to ensure they're fresh
      const loadedMessages = await loadMessages(targetConversationId);
      
      // ✅ FIX: Verify message exists in loaded messages
      const messageExists = loadedMessages?.some(msg => msg.id === messageId);
      if (!messageExists) {
        logger.warn('[ChatPage] ⚠️ Message not found in loaded messages:', {
          messageId,
          conversationId: targetConversationId,
          messagesLoaded: loadedMessages?.length || 0
        });
        // Still try to scroll in case message is in DOM but not in state yet
      }

      // ✅ FIX: Wait for React to render messages, then poll for the element
      // Use requestAnimationFrame to wait for next render cycle
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve)); // Double RAF for React render

      // Poll for message element with retries (up to 2 seconds)
      const maxRetries = 20;
      const retryDelay = 100;
      let messageElement: HTMLElement | null = null;
      
      for (let i = 0; i < maxRetries; i++) {
        messageElement = document.getElementById(`message-${messageId}`);
        if (messageElement) {
          logger.debug('[ChatPage] ✅ Found message element on attempt:', i + 1);
          break;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      if (messageElement) {
        // Small delay to ensure element is fully rendered
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight message briefly
        messageElement.classList.add('ring-2', 'ring-yellow-400', 'rounded-lg');
        setTimeout(() => {
          messageElement?.classList.remove('ring-2', 'ring-yellow-400', 'rounded-lg');
        }, 2000);
        
        logger.debug('[ChatPage] ✅ Successfully navigated to message:', messageId);
      } else {
        logger.warn('[ChatPage] ⚠️ Message element not found after retries:', {
          messageId,
          conversationId: targetConversationId,
          messagesLoaded: loadedMessages?.length || 0,
          messageInState: loadedMessages?.some(msg => msg.id === messageId) || false
        });
        // ✅ FALLBACK: Scroll to bottom if message not found
        const messagesContainer = document.querySelector('[role="log"]') || 
                                 document.querySelector('.overflow-y-auto');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }
    } catch (error) {
      logger.error('[ChatPage] ❌ Failed to navigate to message:', error);
    }
  };

  // User metadata state for MailerLite
  const [userName, setUserName] = useState<string | undefined>(undefined);
  
  // MailerLite event triggers
  const { triggerEvent: triggerMailerLiteEvent } = useMailerEvents(userEmail || '');

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
          setUserName(user.user_metadata?.full_name);
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
  // ✅ BEST PRACTICE: Comprehensive keyboard navigation (WCAG 2.1 Level AA)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when user is typing in input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Cmd+K / Ctrl+K → Open search (industry standard - ChatGPT, Slack, Discord)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
        logger.debug('[ChatPage] 🔍 Search opened via keyboard shortcut');
      }

      // Cmd+N / Ctrl+N → New conversation (industry standard)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        const newConversationId = generateUUID();
        window.history.pushState({ conversationId: newConversationId }, '', `/chat?conversation=${newConversationId}`);
        window.dispatchEvent(new PopStateEvent('popstate', { state: { conversationId: newConversationId } }));
        logger.debug('[ChatPage] 💬 New conversation created via keyboard shortcut');
      }

      // Escape → Close modals/sidebar (WCAG 2.4.3 - Focus Order)
      if (e.key === 'Escape') {
        if (sidebarOpen) {
          setSidebarOpen(false);
          logger.debug('[ChatPage] 🚪 Sidebar closed via Escape');
        }
        if (showSearch) {
          setShowSearch(false);
          logger.debug('[ChatPage] 🔍 Search closed via Escape');
        }
        if (showHistory) {
          setShowHistory(false);
          logger.debug('[ChatPage] 📜 History closed via Escape');
        }
        if (showProfile) {
          setShowProfile(false);
          logger.debug('[ChatPage] 👤 Profile closed via Escape');
        }
      }

      // Cmd+/ or Ctrl+/ → Show keyboard shortcuts help
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        toast.info('Keyboard shortcuts: Cmd+K (Search), Cmd+N (New chat), Esc (Close)', { duration: 3000 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, showSearch, showHistory, showProfile]);

  // ✅ BEST PRACTICE: Lock body scroll while sidebar is open
  // ✅ FIX: Delay scroll unlock until exit animation completes (~400ms for spring)
  useEffect(() => {
    if (sidebarOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        // Delay scroll unlock to match exit animation duration
        setTimeout(() => {
          document.body.style.overflow = prev;
        }, 450); // Slightly longer than spring animation duration (~400ms)
      };
    }
  }, [sidebarOpen]);

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
          
          // ✅ CRITICAL FIX: Detect message type from attachments array (not just image_url)
          let messageType: 'text' | 'image' | 'audio' = 'text';
          if (newMsg.attachments && Array.isArray(newMsg.attachments) && newMsg.attachments.length > 0) {
            // Check attachments array for type
            const hasImage = newMsg.attachments.some((att: any) => att.type === 'image' || att.type === 'photo');
            const hasAudio = newMsg.attachments.some((att: any) => att.type === 'audio' || att.type === 'voice');
            if (hasImage) messageType = 'image';
            else if (hasAudio) messageType = 'audio';
          } else if (newMsg.image_url) {
            // Fallback to legacy image_url field
            messageType = 'image';
          }
          
          const messageToSave = {
            id: newMsg.id,
            conversationId: newMsg.conversation_id,
            userId: userId, // ✅ ALWAYS use authenticated userId, never trust backend
            role: newMsg.role,
            type: messageType, // ✅ CRITICAL FIX: Use detected type from attachments
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
          
          // ✅ CRITICAL FIX: Check if message already exists before saving (prevent duplicates)
          const existingMessage = await atlasDB.messages.get(messageToSave.id);
          if (existingMessage) {
            logger.debug('[ChatPage] ⚠️ Message already exists in Dexie, merging attachments:', messageToSave.id);
            // ✅ FIX: Merge attachments instead of replacing (preserve all images)
            const existingAttachments = Array.isArray(existingMessage.attachments) ? existingMessage.attachments : [];
            const newAttachments = Array.isArray(messageToSave.attachments) ? messageToSave.attachments : [];
            // Merge and deduplicate by URL
            const mergedAttachments = [...existingAttachments, ...newAttachments];
            const uniqueAttachments = [...new Map(mergedAttachments.map(att => [att.url || att.publicUrl || att.id || Math.random(), att])).values()];
            
            await atlasDB.messages.update(messageToSave.id, {
              ...messageToSave,
              attachments: uniqueAttachments.length > 0 ? uniqueAttachments : undefined
            });
          } else {
            // ✅ CRITICAL FIX: Deduplicate attachments before saving
            const uniqueAttachments = messageToSave.attachments && Array.isArray(messageToSave.attachments) && messageToSave.attachments.length > 0
              ? [...new Map(messageToSave.attachments.map(att => [att.url || att.publicUrl || att.id || Math.random(), att])).values()]
              : undefined;
            
            // ✅ TYPESCRIPT FIX: messageToSave already matches Message interface from atlasDB
            await atlasDB.messages.put({
              ...messageToSave,
              attachments: uniqueAttachments
            });
          }
          
          logger.debug('[ChatPage] ✅ Message written to Dexie:', newMsg.id);
          
          // ✅ SMOOTH UPDATE: Replace optimistic message with real one - NO RELOAD
          const realMessage: Message = {
            id: messageToSave.id,
            role: messageToSave.role,
            type: messageType, // ✅ CRITICAL FIX: Use detected type
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
              // ✅ CRITICAL FIX: Match by attachments (image URL) instead of content
              // Content may differ (frontend uses caption, backend uses prompt)
              const tempIndex = updatedMessages.findIndex(m => {
                if (!m.id.startsWith('temp-') || m.role !== 'user') return false;
                
                // Match by attachments (image URL) - more reliable than content
                const tempHasImage = m.attachments?.some(att => att.type === 'image');
                const realHasImage = realMessage.attachments?.some(att => att.type === 'image');
                
                if (tempHasImage && realHasImage) {
                  // ✅ FIX: Match by ALL image URLs (not just first) to handle multiple images correctly
                  const tempImageUrls = m.attachments
                    .filter(att => att.type === 'image')
                    .map(att => att.url || att.publicUrl)
                    .filter(Boolean)
                    .sort();
                  const realImageUrls = realMessage.attachments
                    .filter(att => att.type === 'image')
                    .map(att => att.url || att.publicUrl)
                    .filter(Boolean)
                    .sort();
                  
                  // Match if any image URL matches (for same message with multiple images)
                  // Or if all URLs match (exact match)
                  const hasMatchingUrl = tempImageUrls.some(url => realImageUrls.includes(url));
                  const allUrlsMatch = tempImageUrls.length === realImageUrls.length && 
                                      tempImageUrls.every(url => realImageUrls.includes(url));
                  
                  return hasMatchingUrl || allUrlsMatch;
                }
                
                // Fallback: match by content if no images
                return m.content === realMessage.content;
              });
              
              if (tempIndex !== -1) {
                // ✅ FIX: Merge attachments instead of replacing (preserve all images)
                const tempMessage = updatedMessages[tempIndex];
                const tempAttachments = Array.isArray(tempMessage.attachments) ? tempMessage.attachments : [];
                const realAttachments = Array.isArray(realMessage.attachments) ? realMessage.attachments : [];
                // Merge and deduplicate by URL
                const mergedAttachments = [...tempAttachments, ...realAttachments];
                const uniqueAttachments = [...new Map(mergedAttachments.map(att => [att.url || att.publicUrl || att.id || Math.random(), att])).values()];
                
                // Replace the temp message with the real one, but preserve merged attachments
                updatedMessages[tempIndex] = {
                  ...realMessage,
                  attachments: uniqueAttachments.length > 0 ? uniqueAttachments : realMessage.attachments
                };
                // ✅ CRITICAL FIX: Re-sort after update to maintain chronological order
                updatedMessages.sort((a, b) => {
                  const timeA = new Date(a.timestamp).getTime();
                  const timeB = new Date(b.timestamp).getTime();
                  return timeA - timeB; // Ascending order (oldest first)
                });
                return updatedMessages;
              }
            }
            
            // For assistant messages or if no temp message found, just add/update normally
            const existingIndex = updatedMessages.findIndex(m => m.id === realMessage.id);
            
            if (existingIndex !== -1) {
              // ✅ FIX: Merge attachments instead of replacing (preserve all images)
              const existingMessage = updatedMessages[existingIndex];
              const existingAttachments = Array.isArray(existingMessage.attachments) ? existingMessage.attachments : [];
              const realAttachments = Array.isArray(realMessage.attachments) ? realMessage.attachments : [];
              // Merge and deduplicate by URL
              const mergedAttachments = [...existingAttachments, ...realAttachments];
              const uniqueAttachments = [...new Map(mergedAttachments.map(att => [att.url || att.publicUrl || att.id || Math.random(), att])).values()];
              
              // Update existing message with merged attachments
              updatedMessages[existingIndex] = {
                ...realMessage,
                attachments: uniqueAttachments.length > 0 ? uniqueAttachments : realMessage.attachments
              };
              // ✅ CRITICAL FIX: Re-sort after update to maintain chronological order
              updatedMessages.sort((a, b) => {
                const timeA = new Date(a.timestamp).getTime();
                const timeB = new Date(b.timestamp).getTime();
                return timeA - timeB; // Ascending order (oldest first)
              });
              return updatedMessages;
            } else {
              // Add new message and sort to maintain chronological order
              const newMessages = [...updatedMessages, realMessage];
              newMessages.sort((a, b) => {
                const timeA = new Date(a.timestamp).getTime();
                const timeB = new Date(b.timestamp).getTime();
                return timeA - timeB; // Ascending order (oldest first)
              });
              return newMessages;
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
        // ✅ FIX: Use React Router navigation instead of hard reload
        navigate('/chat', { replace: true });
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
        const initialMessages = await loadMessages(id);
        
        // Sync to get latest messages from backend
        try {
          const { conversationSyncService } = await import('../services/conversationSyncService');
          // ✅ OPTIMIZED: Delta sync already handles both conversations AND messages
          // ✅ ADAPTIVE SYNC: Pass isActive based on typing/streaming state for faster sync
          const isActive = isTyping || isStreaming;
          await conversationSyncService.deltaSync(userId, false, false, isActive);
          
          // ✅ CRITICAL FIX: Reload messages after sync if IndexedDB was empty
          // Real-time listener only handles NEW messages, not existing ones that were just synced
          if (initialMessages.length === 0) {
            logger.debug('[ChatPage] 🔄 IndexedDB was empty, reloading messages after sync...');
            await loadMessages(id);
          } else {
            logger.debug('[ChatPage] ✅ Initial sync complete, real-time listener active');
          }
        } catch (error) {
          logger.error('[ChatPage] Initial sync failed:', error);
        }
        
      } catch (error) {
        logger.error('[ChatPage] Failed to initialize conversation:', error);
      }
    };

    initializeConversation();
  }, [userId]);

  // Check if user should see questionnaire (new user with no conversations)
  useEffect(() => {
    if (!userId || hasCheckedQuestionnaire) return;

    const checkQuestionnaire = async () => {
      try {
        // Check if user has any conversations
        const { count } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        const isNewUser = (count || 0) === 0;

        if (isNewUser) {
          // Check if user has already completed questionnaire
          const { data: profile } = await supabase
            .from('profiles')
            .select('preferences')
            .eq('id', userId)
            .single();

          // Show questionnaire if preferences are null/empty
          if (!profile?.preferences || Object.keys(profile.preferences).length === 0) {
            setShowQuestionnaire(true);
          }
        }

        setHasCheckedQuestionnaire(true);
      } catch (error) {
        logger.error('[ChatPage] Error checking questionnaire:', error);
        setHasCheckedQuestionnaire(true); // Don't retry on error
      }
    };

    checkQuestionnaire();
  }, [userId, hasCheckedQuestionnaire]);
  
  // ✅ CRITICAL FIX: Ensure messages load when BOTH userId and conversationId are available
  // This handles the race condition where conversationId is set before userId on refresh
  useEffect(() => {
    if (userId && conversationId) {
      logger.debug('[ChatPage] 🔄 Both userId and conversationId available, loading messages...');
      loadMessages(conversationId);
    }
  }, [userId, conversationId, loadMessages]);

  // ✅ CROSS-DEVICE SYNC FIX: Reload messages when page becomes visible
  // This ensures messages typed on mobile appear on web when you switch tabs/windows
  useEffect(() => {
    if (!userId || !conversationId || typeof window === 'undefined') return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        logger.debug('[ChatPage] 👁️ Page became visible, reloading messages for sync...');
        // Small delay to ensure real-time subscriptions are active
        setTimeout(async () => {
          await loadMessages(conversationId);
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, conversationId, loadMessages]);

  // ✅ TUTORIAL: Trigger tutorial for first-time users (hook already declared at top)
  useEffect(() => {
    // Diagnostic logging
    logger.debug('[ChatPage] Tutorial check:', { 
      userId, 
      isCompleted, 
      tutorialLoading,
      shouldTrigger: userId && !isCompleted && !tutorialLoading 
    });
    
    // Only trigger tutorial if:
    // 1. User is authenticated
    // 2. Tutorial is not already completed
    // 3. Tutorial is not loading
    // 4. Page is ready (userId is set)
    if (userId && !isCompleted && !tutorialLoading) {
      // Small delay to ensure page is fully rendered
      const timer = setTimeout(() => {
        logger.debug('[ChatPage] 🎓 TRIGGERING TUTORIAL NOW');
        logger.info('[ChatPage] 🎓 Starting tutorial for first-time user');
        startTutorial();
      }, 1000); // 1 second delay for smooth UX

      return () => clearTimeout(timer);
    }
  }, [userId, isCompleted, tutorialLoading, startTutorial]);

  // ✅ FIX: Handle URL changes using React Router's useSearchParams (detects navigate() calls)
  // This works for both React Router navigation AND browser back/forward
  useEffect(() => {
    const urlConversationId = searchParams.get('conversation');
    
    if (import.meta.env.DEV) {
      logger.debug('[ChatPage] 🔍 Checking URL conversation ID:', { urlConversationId, currentConversationId: conversationId });
    }
    
    // Only switch if URL has a different conversation ID
    if (urlConversationId && urlConversationId !== conversationId) {
      if (import.meta.env.DEV) {
        logger.debug('[ChatPage] 🔄 URL changed (via React Router), switching conversation:', urlConversationId);
      }
      
      // ✅ FIX: Clear messages immediately to show new conversation (prevents showing old messages)
      setMessages([]);
      if (import.meta.env.DEV) {
        logger.debug('[ChatPage] 🧹 Cleared messages for new conversation');
      }
      
      // ✅ FIX: Close sidebar smoothly
      if (sidebarOpen) {
        setSidebarOpen(false);
      }
      
      // Update conversation ID and load messages
      localStorage.setItem('atlas:lastConversationId', urlConversationId);
      setConversationId(urlConversationId);
      
      // Only load messages if userId is available
      if (userId) {
        loadMessages(urlConversationId);
      } else {
        logger.debug('[ChatPage] ⚠️ userId not ready yet, will load messages when available');
      }
    } else if (!urlConversationId && conversationId) {
      // ✅ FIX: If URL has no conversation ID but we have one in state, update URL
      logger.debug('[ChatPage] ⚠️ URL missing conversation ID, updating URL');
      navigate(`/chat?conversation=${conversationId}`, { replace: true });
    }
  }, [searchParams, conversationId, userId, navigate]); // ✅ FIX: navigate is stable, loadMessages is stable callback

  // ✅ MOBILE FIX: Also listen to popstate for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlConversationId = urlParams.get('conversation');
      
      // Only switch if URL has a different conversation ID
      if (urlConversationId && urlConversationId !== conversationId) {
        logger.debug('[ChatPage] 🔄 URL changed (via browser navigation), switching conversation:', urlConversationId);
        
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
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
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
              // ✅ FIX: Use centralized API client for consistency and proper error handling
              try {
                const apiUrl = getApiEndpoint(`/v1/user_profiles/${user.id}`);
                const response = await fetch(apiUrl, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                });
                
                if (response.ok) {
                  const profile = await response.json();
                  const tier = profile?.subscription_tier || 'core';
                  startBackgroundSync(user.id, tier);
                } else {
                  // ✅ FIX: Log error but don't block - use default tier
                  logger.warn(`[ChatPage] Profile fetch failed (${response.status}), using default tier`);
                  startBackgroundSync(user.id, 'core');
                }
              } catch (error) {
                // ✅ FIX: Handle fetch errors gracefully
                logger.warn('[ChatPage] Profile fetch error, using default tier:', error);
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
      <div className="min-h-screen bg-atlas-pearl dark:bg-[#0F121A] transition-colors duration-200">
        {/* Header Skeleton - White gradient effect (visible fade) */}
        <div 
          className={`sticky top-0 z-30 transition-all duration-300 bg-white dark:bg-[#1A1D26] border-b border-gray-200 dark:border-[#2A2E3A]`}
          style={{ 
            backdropFilter: 'none !important',
            WebkitBackdropFilter: 'none !important',
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
                  // ✅ FIX: Show error UI instead of reloading (better UX, preserves state)
                  logger.error('[ChatPage] Reconnection failed:', error);
                  toast.error('Failed to reconnect. Please try again or refresh manually.', {
                    duration: 5000,
                    action: {
                      label: 'Refresh',
                      onClick: async () => {
                        // ✅ UX IMPROVEMENT: Use React Router refresh instead of hard reload
                        // Preserves React state and provides better mobile UX
                        if (conversationId) {
                          try {
                            await loadMessages(conversationId);
                            setHealthError(null);
                            toast.success('Messages refreshed');
                          } catch (error) {
                            logger.error('[ChatPage] Refresh failed:', error);
                            // Fallback to React Router refresh if loadMessages fails
                            navigate(0);
                          }
                        } else {
                          // No conversation loaded, use React Router refresh
                          navigate(0);
                        }
                      }
                    }
                  });
                  // Don't auto-reload - let user decide
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
      <div 
        className="min-h-screen bg-atlas-pearl dark:bg-[#0F121A] text-atlas-text-dark dark:text-white transition-colors duration-200"
        style={{
          // ✅ FIX: Use consistent 100dvh to prevent layout jumps
          minHeight: '100dvh',
          height: '100dvh', // Fixed height prevents jumps when browser UI changes
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          // ✅ REMOVED: Hardcoded backgroundColor - now uses Tailwind dark: classes
          // ✅ FIX: Prevent layout shifts from browser UI
          overflow: 'hidden', // Prevent scroll on container
        }}
      >
        {/* Header - White gradient effect (visible fade) */}
        <div 
          className="sticky top-0 z-30 transition-all duration-300 bg-white dark:bg-[#1A1D26] border-b border-gray-200 dark:border-[#2A2E3A] shadow-sm"
          style={{ 
            // ✅ REMOVED: Hardcoded light mode styles - now uses Tailwind dark: classes
            backdropFilter: 'none !important',
            WebkitBackdropFilter: 'none !important',
          }}
        >
          <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <button
                  onClick={() => {
                    setSidebarOpen(!sidebarOpen);
                  }}
                  className="p-2 rounded-lg bg-atlas-sage/10 dark:bg-[#2A2E3A]/50 hover:bg-atlas-sage/20 dark:hover:bg-[#2A2E3A] transition-colors"
                >
                  <Menu className="w-5 h-5 text-atlas-stone dark:text-gray-300" />
                </button>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-atlas-text-dark dark:text-white" style={{ fontWeight: 700 }}>Atlas AI</h1>
                  <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base hidden sm:block">Emotionally intelligent productivity assistant</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-4">
                {/* Notifications */}
                {userId && (
                  <NotificationCenter />
                )}
                {/* Search Button - PHASE 2B */}
                <button
                  onClick={() => setShowSearch(true)}
                  className="p-2 rounded-lg bg-atlas-sage/10 dark:bg-[#2A2E3A]/50 hover:bg-atlas-sage/20 dark:hover:bg-[#2A2E3A] transition-colors group"
                  title="Search messages (Cmd+K)"
                  aria-label="Search messages"
                >
                  <Search className="w-5 h-5 text-atlas-stone dark:text-gray-300 group-hover:text-atlas-sage dark:group-hover:text-gray-200" />
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
              {/* ✅ BEST PRACTICE: Backdrop with explicit transition */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setSidebarOpen(false)}
                onTouchStart={(e) => {
                  // ✅ MOBILE FIX: Handle touch events for mobile devices
                  e.stopPropagation();
                }}
              />
              
              {/* ✅ BEST PRACTICE: Sidebar with consistent animation */}
              {/* ✅ RESPONSIVE: Full width on mobile, fixed width on desktop */}
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed left-0 top-0 h-full w-full sm:w-80 bg-atlas-pearl dark:bg-[#1A1D26] border-r border-atlas-border dark:border-[#2A2E3A] z-50 overflow-y-auto shadow-xl"
                onClick={(e) => {
                  // ✅ CRITICAL FIX: Prevent sidebar content clicks from closing sidebar
                  e.stopPropagation();
                }}
              >
                <div className="p-3 sm:p-4 space-y-4 sm:space-y-6">
                  {/* Header with Profile and Close Buttons */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-base sm:text-lg font-semibold text-atlas-text-dark dark:text-white">Menu</h2>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        onClick={() => setShowProfile(true)}
                        className="p-2 rounded-xl bg-atlas-button dark:bg-[#2A2E3A]/50 hover:bg-atlas-button-hover dark:hover:bg-[#2A2E3A] transition-colors"
                        aria-label="Open profile settings"
                        title="Profile Settings"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-atlas-gradient-start to-atlas-gradient-end flex items-center justify-center text-sm font-semibold text-gray-900">
                          {userEmail?.[0]?.toUpperCase() || '?'}
                        </div>
                      </button>
                      <button
                        onClick={() => setSidebarOpen(false)}
                        className="p-2 rounded-xl bg-atlas-button dark:bg-[#2A2E3A]/50 hover:bg-atlas-button-hover dark:hover:bg-[#2A2E3A] transition-colors"
                        aria-label="Close menu"
                      >
                        <X className="w-5 h-5 text-atlas-text-medium dark:text-gray-300" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Sidebar Content */}
                  <QuickActions 
                    onViewHistory={handleViewHistory}
                    onNewChat={() => setSidebarOpen(false)}
                  />
                  <UsageCounter userId={userId ?? ''} />
                  {/* ✅ EMOTIONAL INSIGHTS WIDGETS: Show mood tracking and conversation analysis */}
                  {userId && <EmotionalInsightsWidgets userId={userId} isOpen={sidebarOpen} />}
                  
                  {/* Rituals Button */}
                  <button
                    onClick={() => {
                      navigate('/rituals');
                      setSidebarOpen(false); // Close sidebar after navigation
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-atlas-text-medium dark:text-gray-300 bg-atlas-button dark:bg-[#2A2E3A]/50 hover:bg-atlas-button-hover dark:hover:bg-[#2A2E3A] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-atlas-accent-1/30 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-atlas-accent-1" />
                    </div>
                    <div className="text-left flex-1">
                      <span className="font-medium text-sm">Rituals</span>
                      <p className="text-atlas-text-muted dark:text-gray-400 text-xs">Mindfulness & Focus</p>
                    </div>
                  </button>
                  
                  <PrivacyToggle />
                  
                  {/* Divider */}
                  <div className="my-4 border-t border-atlas-border/50"></div>
                  
                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-atlas-text-medium dark:text-gray-300 bg-atlas-button dark:bg-[#2A2E3A]/50 hover:bg-atlas-button-hover dark:hover:bg-[#2A2E3A] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-atlas-accent-2/30 flex items-center justify-center">
                      <LogOut className="w-4 h-4 text-atlas-accent-3" />
                    </div>
                    <div className="text-left flex-1">
                      <span className="font-medium text-sm">Sign Out</span>
                      <p className="text-atlas-text-muted dark:text-gray-400 text-xs">End your session</p>
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
          className="flex flex-col bg-atlas-pearl dark:bg-[#0F121A]"
          style={{
            // ✅ FIX: Use dvh consistently to prevent jumps
            height: 'calc(100dvh - 120px)', // Account for header height
            maxHeight: 'calc(100dvh - 120px)',
            overflow: 'hidden', // Prevent container scroll
          }}
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
            className="flex-1 overflow-y-auto px-4 py-6 pt-4 pb-32 bg-atlas-pearl dark:bg-[#0F121A] transition-colors duration-200"
            role="log"
            aria-live="polite"
            aria-label="Message list"
            style={{
              // ✅ FIX: Ensure proper scrolling with dvh
              minHeight: 0, // Allow flex child to shrink
              WebkitOverflowScrolling: 'touch', // Smooth iOS scrolling
              // ✅ BEST PRACTICE: Optimize touch performance for pull-to-refresh
              touchAction: pullDistance > 0 ? 'pan-y' : 'auto', // Allow vertical scroll when not pulling
              // ✅ UX IMPROVEMENT: Pull-to-refresh visual feedback
              transform: pullDistance > 0 ? `translateY(${Math.min(pullDistance, 150)}px)` : undefined,
              transition: pullDistance > 0 ? 'none' : 'transform 0.2s ease-out',
            }}
            onTouchStart={(e) => {
              // ✅ UX IMPROVEMENT: Pull-to-refresh touch start handler
              if (!isMobile || isRefreshing || !conversationId) return;
              const container = messagesContainerRef.current;
              if (container && container.scrollTop > 10) return;
              const now = Date.now();
              if (now - lastRefreshTimeRef.current < 2000) return;
              touchStartTimeRef.current = now;
              setPullStartY(e.touches[0].clientY);
            }}
            onTouchMove={(e) => {
              // ✅ UX IMPROVEMENT: Pull-to-refresh touch move handler
              if (!isMobile || pullStartY === 0 || isRefreshing || !conversationId) return;
              const container = messagesContainerRef.current;
              if (container && container.scrollTop > 10) {
                setPullDistance(0);
                setPullStartY(0);
                return;
              }
              const distance = Math.max(0, e.touches[0].clientY - pullStartY);
              // ✅ BEST PRACTICE: Prevent default scroll when actively pulling
              if (distance > 10) {
                e.preventDefault();
              }
              if (distance > 0 && distance < 150) {
                setPullDistance(distance);
              } else if (distance >= 150) {
                setPullDistance(150);
              }
            }}
            onTouchEnd={async () => {
              // ✅ UX IMPROVEMENT: Pull-to-refresh touch end handler
              if (!isMobile || pullDistance < 100 || isRefreshing || !conversationId) {
                setPullDistance(0);
                setPullStartY(0);
                touchStartTimeRef.current = 0;
                return;
              }
              const touchDuration = Date.now() - touchStartTimeRef.current;
              if (touchDuration < 200) {
                setPullDistance(0);
                setPullStartY(0);
                touchStartTimeRef.current = 0;
                return;
              }
              const now = Date.now();
              if (now - lastRefreshTimeRef.current < 2000) {
                setPullDistance(0);
                setPullStartY(0);
                touchStartTimeRef.current = 0;
                return;
              }
              setIsRefreshing(true);
              lastRefreshTimeRef.current = now;
              triggerHaptic(50);
              setPullDistance(0);
              setPullStartY(0);
              touchStartTimeRef.current = 0;
              
              try {
                // Load older messages on pull-to-refresh
                const oldestMessage = messages[0];
                if (oldestMessage?.timestamp) {
                  await loadOlderMessages(conversationId, oldestMessage.timestamp);
                  triggerHaptic(100);
                  toast.success('Loaded older messages');
                } else {
                  // If no messages, reload current messages
                  await loadMessages(conversationId);
                  triggerHaptic(100);
                  toast.success('Messages refreshed');
                }
              } catch (error) {
                logger.error('[ChatPage] Pull-to-refresh failed:', error);
                toast.error('Failed to refresh. Please try again.');
              } finally {
                setIsRefreshing(false);
              }
            }}
            onScroll={() => {
              // 📱 Dismiss keyboard when scrolling (ChatGPT-like behavior)
              if (inputRef.current) {
                inputRef.current.blur();
              }
            }}
          >
            <div className="max-w-4xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 2vw, 16px)' }}>
              
              <MessageListWithPreviews>
                {(() => {
                  const safeMessages = messages || [];
                  // ✅ CRITICAL FIX: Debug logging for mobile message display issue
                  if (typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                    logger.debug('[ChatPage] 📱 Mobile message rendering:', {
                      totalMessages: safeMessages.length,
                      userMessages: safeMessages.filter(m => m.role === 'user').length,
                      assistantMessages: safeMessages.filter(m => m.role === 'assistant').length,
                      unsyncedMessages: safeMessages.filter(m => !m.synced).length,
                      messageRoles: safeMessages.map(m => ({ id: m.id, role: m.role, content: m.content?.substring(0, 30) }))
                    });
                  }
                  if (safeMessages.length > 0) {
                    return (
                      <>
                        {/* ✅ UX IMPROVEMENT: Pull-to-refresh indicator */}
                        {isRefreshing && (
                          <div className="flex justify-center py-2">
                            <div className="flex items-center gap-2 text-sm text-atlas-text-medium dark:text-gray-400">
                              <div className="w-5 h-5 border-2 border-atlas-text-medium dark:border-gray-400 border-t-transparent rounded-full animate-spin" />
                              <span>Loading older messages...</span>
                            </div>
                          </div>
                        )}
                        
                        {/* ✅ UX IMPROVEMENT: Pull-to-refresh hint (mobile only, when at top) */}
                        {isMobile && pullDistance > 0 && pullDistance < 100 && !isRefreshing && (
                          <div className="flex justify-center py-2">
                            <div className="text-xs text-atlas-text-medium dark:text-gray-400">
                              Pull to load older messages
                            </div>
                          </div>
                        )}
                        
                        {/* ✅ SCALABILITY: Load Older Messages button (desktop fallback) */}
                        {hasMoreMessages && conversationId && !isMobile && (
                          <div className="flex justify-center py-4">
                            <button
                              onClick={() => {
                                const oldestMessage = safeMessages[0];
                                if (oldestMessage?.timestamp) {
                                  loadOlderMessages(conversationId, oldestMessage.timestamp);
                                }
                              }}
                              onKeyDown={(e) => {
                                // ✅ BEST PRACTICE: Keyboard accessibility
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  const oldestMessage = safeMessages[0];
                                  if (oldestMessage?.timestamp) {
                                    loadOlderMessages(conversationId, oldestMessage.timestamp);
                                  }
                                }
                              }}
                              disabled={isLoadingOlderMessages}
                              className="px-4 py-2 text-sm font-medium text-atlas-text-medium dark:text-gray-300 bg-atlas-button dark:bg-[#2A2E3A]/50 hover:bg-atlas-button-hover dark:hover:bg-[#2A2E3A] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-atlas-sage focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                              aria-label="Load older messages"
                              aria-busy={isLoadingOlderMessages}
                            >
                              {isLoadingOlderMessages ? 'Loading...' : 'Load Older Messages'}
                            </button>
                          </div>
                        )}
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
                    // ✅ MODERN: Web-style empty state matching reference design with Atlas branding
                    return (
                      <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center min-h-[60vh] sm:min-h-[400px]">
                        {/* Atlas Logo - Original logo */}
                        <div className="mb-8 sm:mb-10">
                          <img
                            src="/atlas-logo.png"
                            alt="Atlas AI Logo"
                            className="mx-auto h-24 w-24 sm:h-32 sm:w-32"
                          />
                        </div>
                        
                        {/* Welcome heading - Theme-aware text */}
                        <h2 className="text-3xl sm:text-4xl font-semibold text-atlas-text-dark dark:text-white mb-3 sm:mb-4">
                          Welcome to Atlas AI
                        </h2>
                        
                        {/* Description - Theme-aware text */}
                        <p className="text-base sm:text-lg text-atlas-text-medium dark:text-gray-300 mb-4 sm:mb-6 max-w-md mx-auto leading-relaxed">
                          Emotionally intelligent productivity assistant is ready to help.
                        </p>
                        
                        {/* Call to action - Theme-aware text */}
                        <p className="text-sm sm:text-base text-atlas-text-muted dark:text-gray-400 mb-8 sm:mb-10 max-w-sm mx-auto">
                          Start a conversation below!
                        </p>
                      </div>
                    );
                  }
                })()}
              </MessageListWithPreviews>
              
              {/* Scroll anchor */}
              <div ref={bottomRef} />
            </div>
          </div>

        {/* ✅ MODAL-AWARE: Check if any modals are open */}
        {(() => {
          const hasOpenModal = sidebarOpen || showHistory || showProfile || showSearch || genericModalVisible;
          
          return (
            <>
              {/* ✅ UNIFIED CONTAINER: Mobile floating overlay + Desktop static footer - hide when modals open */}
              {!hasOpenModal && (
                <div
                  className="
                    fixed bottom-[12px] left-0 right-0 z-[10000]
                    pt-3 pb-3 px-[max(8px,env(safe-area-inset-left,0px))] pr-[max(8px,env(safe-area-inset-right,0px))]
                    sm:static sm:z-auto sm:pt-0 sm:pb-0 sm:px-0 sm:pr-0 sm:bottom-0
                  "
                  style={{
                    backgroundColor: 'transparent', // ✅ TRANSPARENT: Allows chatbox to float above page background
                    backdropFilter: 'none',
                    WebkitBackdropFilter: 'none',
                    transform: 'translateZ(0)', // ✅ GPU acceleration
                  }}
                >
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
              )}
            </>
          );
        })()}
        </main>

        {/* Modern scroll-to-bottom button with golden sparkle - hide when drawer/modal is open */}
        <ScrollToBottomButton
          onClick={scrollToBottom}
          visible={showScrollButton && !sidebarOpen && !showHistory && !showProfile && !showSearch}
          shouldGlow={shouldGlow}
        />

        {/* ✅ Use VoiceUpgradeModal for ALL upgrade scenarios (consistent warm UI) */}
        <ErrorBoundary fallback={
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Upgrade Modal Error</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">There was an issue loading the upgrade modal. Please try again.</p>
              <button
                onClick={hideGenericUpgrade}
                className="px-4 py-2 bg-atlas-sage dark:bg-gray-700 text-white rounded-md hover:bg-atlas-success dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        }>
          <VoiceUpgradeModal
            isOpen={genericModalVisible}
            onClose={hideGenericUpgrade}
            feature={genericModalFeature === 'audio' ? 'audio' : genericModalFeature === 'image' ? 'image' : genericModalFeature === 'file' ? 'file' : genericModalFeature === 'camera' ? 'camera' : 'voice_calls'}
            defaultTier={genericModalFeature === 'audio' || genericModalFeature === 'image' || genericModalFeature === 'file' ? 'core' : 'studio'}
          />
        </ErrorBoundary>


        {/* Conversation History Modal - Rendered at page level for proper mobile centering */}
        {historyData && (
          <ErrorBoundary fallback={
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Conversation History Error</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">There was an issue loading conversation history. Please try again.</p>
                <button
                  onClick={() => setShowHistory(false)}
                  className="px-4 py-2 bg-atlas-sage dark:bg-gray-700 text-white rounded-md hover:bg-atlas-success dark:hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          }>
            <ConversationHistoryDrawer
              isOpen={showHistory}
              onClose={() => setShowHistory(false)}
              conversations={historyData.conversations}
              onDeleteConversation={historyData.onDeleteConversation}
              deletingId={historyData.deletingId}
              onRefresh={historyData.onRefresh}
              userId={userId || undefined} // ✅ Pass userId for live insight widgets
            />
          </ErrorBoundary>
        )}

        {/* Search Drawer - PHASE 2B */}
        {userId && (
          <ErrorBoundary fallback={
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Search Error</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">There was an issue loading search. Please try again.</p>
                <button
                  onClick={() => setShowSearch(false)}
                  className="px-4 py-2 bg-atlas-sage dark:bg-gray-700 text-white rounded-md hover:bg-atlas-success dark:hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          }>
            <SearchDrawer
              isOpen={showSearch}
              onClose={() => setShowSearch(false)}
              userId={userId}
              currentConversationId={conversationId || undefined}
              onNavigateToMessage={handleNavigateToMessage}
            />
          </ErrorBoundary>
        )}

        {/* Profile Settings Modal */}
        <ErrorBoundary fallback={
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Settings Error</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">There was an issue loading settings. Please try again.</p>
              <button
                onClick={() => setShowProfile(false)}
                className="px-4 py-2 bg-atlas-sage dark:bg-gray-700 text-white rounded-md hover:bg-atlas-success dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        }>
          <ProfileSettingsModal
            isOpen={showProfile}
            onClose={() => setShowProfile(false)}
            onSignOut={handleLogout}
          />
        </ErrorBoundary>

        {/* ✅ PWA Install Prompt - Shows on mobile for better UX */}
        <PWAInstallPrompt />

        {/* User Questionnaire */}
        {userId && (
          <UserQuestionnaire
            isOpen={showQuestionnaire}
            onClose={() => setShowQuestionnaire(false)}
            userId={userId}
          />
        )}

        {/* MailerLite Integration - Auto-syncs user data and triggers events */}
        {/* ✅ FIX: Only show in development OR with ?admin=true query param for testing */}
        {/* ✅ ULTRA PRO: Admin hardening - restrict ?admin=true to admin users only */}
        {(() => {
          const isDev = import.meta.env.DEV;
          const hasAdminParam = searchParams.get('admin') === 'true';
          const isAdminUser = userEmail === 'jasonc.jpg@gmail.com'; // ✅ Admin email check
          
          return (isDev || (hasAdminParam && isAdminUser)) && userId && userEmail ? (
            <MailerLiteIntegration
              userEmail={userEmail}
              userName={userName}
              userTier={tier || 'free'}
              conversationsToday={dailyUsage || 0}
              totalConversations={messages.length} // Use message count as proxy
              onError={(error) => {
                logger.debug('[MailerLite] Error:', error);
                // Don't show errors to user - MailerLite is non-critical
              }}
              onSuccess={(operation) => {
                logger.debug('[MailerLite] Success:', operation);
              }}
            />
          ) : null;
        })()}
        
      </div>
    </ErrorBoundary>
  );
};

export default ChatPage;