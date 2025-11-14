import { History, Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { atlasDB } from '../../database/atlasDB';
import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabaseClient';
import { deleteConversation } from '../../services/conversationDeleteService';
import { generateUUID } from '../../utils/uuid';
import { ConfirmDialog } from '../modals/ConfirmDialog';

interface QuickActionsProps {
  onViewHistory?: (data: { 
    conversations: any[]; 
    onDeleteConversation: (id: string) => void; 
    deletingId: string | null;
    onRefresh: () => Promise<void>;
  }) => void;
}

export default function QuickActions({ onViewHistory }: QuickActionsProps) {
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, setConversations] = useState<any[]>([]); // State for UI updates
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // ✅ BEST PRACTICE: Confirmation dialog state
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [isClearingData, setIsClearingData] = useState(false);
  
  // ✅ Simple caching to avoid repeated DB calls
  const [cachedConversations, setCachedConversations] = useState<any[]>([]);
  const [lastCacheTime, setLastCacheTime] = useState(0);

  // ✅ ENTERPRISE: Listen for real-time deletion events
  useEffect(() => {
    const handleConversationDeleted = async (event: CustomEvent) => {
      logger.debug('[QuickActions] 🔔 Real-time deletion event received:', event.detail.conversationId);
      
      // Refresh conversation list immediately
      await refreshConversationList();
    };

    window.addEventListener('conversationDeleted', handleConversationDeleted as unknown as EventListener);
    
    return () => {
      window.removeEventListener('conversationDeleted', handleConversationDeleted as unknown as EventListener);
    };
  }, []);

  const refreshConversationList = async (forceRefresh = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = Date.now();
      
      // ✅ Use cache if less than 30 seconds old and not forcing refresh
      if (!forceRefresh && now - lastCacheTime < 30000 && cachedConversations.length > 0) {
        logger.debug('[QuickActions] ✅ Using cached conversations');
        setConversations(cachedConversations);
        
        if (onViewHistory) {
          onViewHistory({
            conversations: cachedConversations,
            onDeleteConversation: handleDeleteConversation,
            deletingId: null,
            onRefresh: async () => {
              await refreshConversationList(true);
            }
          });
        }
        return cachedConversations;
      }

      logger.debug('[QuickActions] 🔄 Fetching fresh conversations from database');
      
      // ✅ FIX: Always sync from Supabase when force refresh to ensure mobile/web parity
      if (forceRefresh) {
        logger.debug('[QuickActions] 📡 Force refresh - syncing from Supabase...');
        try {
          const { conversationSyncService } = await import('../../services/conversationSyncService');
          await conversationSyncService.deltaSync(user.id);
          logger.debug('[QuickActions] ✅ Force sync completed');
        } catch (syncError) {
          logger.error('[QuickActions] ❌ Force sync failed:', syncError);
          // Continue anyway - will use whatever is in IndexedDB
        }
      }
      
      // ⚡ SCALABILITY FIX: Limit at database level
      // ✅ CRITICAL: Filter out deleted conversations
      let conversations = await atlasDB.conversations
        .where('userId')
        .equals(user.id)
        .filter(conv => !conv.deletedAt) // ✅ Filter out soft-deleted conversations
        .reverse() // Most recent first
        .limit(50) // Prevent memory overload
        .toArray();
      
      logger.debug(`[QuickActions] 📊 Found ${conversations.length} conversations in IndexedDB`);
      
      // ✅ FIX: If IndexedDB is empty (common on mobile/fresh browser), sync from Supabase FIRST
      if (conversations.length === 0) {
        logger.debug('[QuickActions] 📡 IndexedDB empty, syncing from Supabase...');
        try {
          const { conversationSyncService } = await import('../../services/conversationSyncService');
          await conversationSyncService.deltaSync(user.id);
          
          // ✅ Read again after sync
          conversations = await atlasDB.conversations
            .where('userId')
            .equals(user.id)
            .filter(conv => !conv.deletedAt) // ✅ Filter out soft-deleted conversations
            .reverse()
            .limit(50)
            .toArray();
          
          logger.debug(`[QuickActions] ✅ Synced ${conversations.length} conversations from Supabase`);
        } catch (syncError) {
          logger.error('[QuickActions] ❌ Sync failed, showing empty list:', syncError);
          // Continue with empty list rather than crashing
        }
      }
      
      // Transform for backward compatibility
      const mappedConversations = conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        created_at: conv.createdAt,
        updated_at: conv.updatedAt,
        user_id: conv.userId
      }));

      // ✅ Cache the results
      setCachedConversations(mappedConversations);
      setLastCacheTime(now);
      setConversations(mappedConversations);
      
      // Update modal if it's open
      if (onViewHistory) {
        onViewHistory({
          conversations: mappedConversations,
          onDeleteConversation: handleDeleteConversation,
          deletingId: null,
          onRefresh: async () => {
            await refreshConversationList(true);
          }
        });
      }
      
      logger.debug('[QuickActions] ✅ Conversation list refreshed and cached');
      return mappedConversations;
    } catch (error) {
      logger.error('[QuickActions] ❌ Failed to refresh conversation list:', error);
      return [];
    }
  };

  const handleNewChat = async () => {
    logger.debug('[QuickActions] 🚀 Starting new chat...');
    console.log('[QuickActions] 🚀 Starting new chat...'); // ✅ DEBUG: Visible in production
    
    // ✅ Create new conversation ID (browser-compatible)
    const newConversationId = generateUUID();
    logger.debug('[QuickActions] ✅ Generated new conversation ID:', newConversationId);
    console.log('[QuickActions] ✅ Generated new conversation ID:', newConversationId); // ✅ DEBUG
    
    // ✅ FIX: Use replace: true to force navigation even if already on /chat route
    // This ensures React Router treats it as a new navigation
    const targetUrl = `/chat?conversation=${newConversationId}`;
    logger.debug('[QuickActions] 🔄 Navigating to:', targetUrl);
    console.log('[QuickActions] 🔄 Navigating to:', targetUrl); // ✅ DEBUG
    
    // ✅ FIX: Use replace: true to force React Router to update (prevents optimization skip)
    navigate(targetUrl, { replace: true });
    
    logger.debug('[QuickActions] ✅ Navigation triggered via React Router');
    console.log('[QuickActions] ✅ Navigation complete'); // ✅ DEBUG
  };

  const handleViewHistory = async () => {
    if (isLoadingHistory) return; // ✅ Prevent duplicate clicks
    
    setIsLoadingHistory(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logger.debug('[QuickActions] No authenticated user - cannot load history');
        return;
      }

      logger.debug('[QuickActions] Loading conversations for user:', user.id);
      
      // ✅ FIX: Always force refresh to ensure mobile and web show same data
      await refreshConversationList(true);
      
      logger.debug('[QuickActions] ✅ View History loaded with latest data');
    } catch (err) {
      logger.error('[QuickActions] Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    // ✅ BEST PRACTICE: Show custom confirmation dialog
    setConversationToDelete(conversationId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteConversation = async () => {
    if (!conversationToDelete) return;

    const conversationId = conversationToDelete;
    setDeletingId(conversationId);
    setShowDeleteConfirm(false);
    
    // ✅ OPTIMISTIC UI: Remove from cached list immediately
    const previousConversations = [...cachedConversations];
    setCachedConversations(prev => prev.filter(c => c.id !== conversationId));
    
    try {
      // Get user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Please login again');

      // ✅ Use unified soft delete service
      await deleteConversation(conversationId, user.id);

      // Refresh list after successful delete to ensure sync
      await refreshConversationList(true);
      
      logger.info('[QuickActions] ✅ Conversation deleted successfully');
      toast.success('Conversation deleted successfully');
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('[QuickActions] ❌ Delete failed:', err);
      
      // ✅ ROLLBACK: Restore conversation on failure
      setCachedConversations(previousConversations);
      
      // ✅ BEST PRACTICE: Use toast instead of alert for better UX (mobile-friendly, accessible)
      toast.error(`Failed to delete conversation: ${error.message || 'Unknown error'}`, {
        duration: 5000,
        description: 'Please try again.',
      });
    } finally {
      setDeletingId(null);
      setConversationToDelete(null);
    }
  };

  const handleClearData = () => {
    // ✅ BEST PRACTICE: Show custom confirmation dialog
    setShowClearDataConfirm(true);
  };

  const confirmClearData = async () => {
    setShowClearDataConfirm(false);
    setIsClearingData(true);

    try {
      logger.debug('[QuickActions] Clearing all local data...');
      
      // Import and call resetLocalData utility
      const { resetLocalData } = await import('@/utils/resetLocalData');
      await resetLocalData();
      
    } catch (err) {
      logger.error('[QuickActions] Failed to clear data:', err);
      toast.error('Failed to clear data. Please try again.');
      setIsClearingData(false);
    }
    // Note: resetLocalData() will reload the page, so setIsClearingData won't run
  };

  const actions = [
    { 
      icon: Plus, 
      label: 'Start New Chat', 
      action: handleNewChat,
      color: 'emerald'
    },
    { 
      icon: isLoadingHistory ? Loader2 : History, 
      label: isLoadingHistory ? 'Loading...' : 'View History', 
      action: handleViewHistory,
      disabled: isLoadingHistory,
      color: 'blue',
      animate: isLoadingHistory
    },
    { 
      icon: Trash2, 
      label: 'Clear All Data', 
      action: handleClearData,
      color: 'red'
    }
  ];

  return (
    <>
      <div className="p-4">
        <h3 className="text-sm font-medium text-[#8B7E74] uppercase tracking-wider mb-3">Quick Actions</h3>
        <ul className="space-y-2">
          <li>
            <button
              onClick={handleNewChat}
              aria-label="Start a new conversation"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white bg-[#8FA67E] hover:bg-[#7E9570] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[#8FA67E] focus-visible:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" aria-hidden="true" />
              </div>
              <span className="font-medium">Start New Chat</span>
            </button>
          </li>
          
          <li>
            <button
              onClick={handleViewHistory}
              disabled={isLoadingHistory}
              aria-label={isLoadingHistory ? 'Loading conversation history' : 'View conversation history'}
              aria-busy={isLoadingHistory}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#5A524A] bg-[#C6D4B0] hover:bg-[#B8C6A2] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#8FA67E] focus-visible:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-[#5A524A]/20 flex items-center justify-center">
                {isLoadingHistory ? (
                  <Loader2 className="w-4 h-4 text-[#5A524A] animate-spin" aria-hidden="true" />
                ) : (
                  <History className="w-4 h-4 text-[#5A524A]" aria-hidden="true" />
                )}
              </div>
              <span className="font-medium">{isLoadingHistory ? 'Loading...' : 'View History'}</span>
            </button>
          </li>
          
          <li>
            <button
              onClick={handleClearData}
              disabled={isClearingData}
              aria-label="Clear all local data (conversations and cache will be removed)"
              aria-busy={isClearingData}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#5A524A] bg-[#F0E6DC] hover:bg-[#E8DDD2] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#A67571] focus-visible:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-[#CF9A96]/30 flex items-center justify-center">
                {isClearingData ? (
                  <Loader2 className="w-4 h-4 text-[#A67571] animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="w-4 h-4 text-[#A67571]" aria-hidden="true" />
                )}
              </div>
              <span className="font-medium">{isClearingData ? 'Clearing...' : 'Clear All Data'}</span>
            </button>
          </li>
        </ul>
      </div>

      {/* ✅ BEST PRACTICE: Custom confirmation dialogs */}
      <ConfirmDialog
        isOpen={showClearDataConfirm}
        onClose={() => setShowClearDataConfirm(false)}
        onConfirm={confirmClearData}
        title="Clear All Data"
        message="This will clear all local conversations and cache. Your account data is safe on the server. This action cannot be undone."
        confirmLabel="Clear All Data"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={isClearingData}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setConversationToDelete(null);
        }}
        onConfirm={confirmDeleteConversation}
        title="Delete Conversation"
        message="Are you sure you want to delete this conversation? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={!!deletingId}
      />
    </>
  );
}
