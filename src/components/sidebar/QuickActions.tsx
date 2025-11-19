import { History, Loader2, Plus } from 'lucide-react';
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
  onNewChat?: () => void; // ✅ FIX: Callback to close sidebar when starting new chat
}

export default function QuickActions({ onViewHistory, onNewChat }: QuickActionsProps) {
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, setConversations] = useState<any[]>([]); // State for UI updates
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // ✅ BEST PRACTICE: Confirmation dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  
  // ✅ Simple caching to avoid repeated DB calls
  const [cachedConversations, setCachedConversations] = useState<any[]>([]);
  const [lastCacheTime, setLastCacheTime] = useState(0);

  // ✅ ENTERPRISE: Listen for real-time deletion events
  useEffect(() => {
    const handleConversationDeleted = async (event: CustomEvent) => {
      logger.debug('[QuickActions] 🔔 Real-time deletion event received:', event.detail.conversationId);
      
      // Refresh conversation list immediately
      try {
        await refreshConversationList();
      } catch (err) {
        logger.error('[QuickActions] Failed to refresh after deletion event:', err);
      }
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
      // ✅ BEST PRACTICE: Auto-sync happens invisibly when drawer opens (no manual button needed)
      if (forceRefresh) {
        logger.debug('[QuickActions] 📡 Force refresh - auto-syncing from Supabase...');
        try {
          const { conversationSyncService } = await import('../../services/conversationSyncService');
          
          // ✅ COMPREHENSIVE SYNC FIX: Check for missing conversations and force full sync if needed
          // This ensures mobile/web parity by comparing counts and syncing all if mismatch detected
          await conversationSyncService.deltaSync(user.id, true, true); // force=true, checkForMissing=true
          
          logger.debug('[QuickActions] ✅ Auto-sync completed - conversations synced');
        } catch (syncError) {
          logger.error('[QuickActions] ❌ Auto-sync failed:', syncError);
          // Continue anyway - will use whatever is in IndexedDB (graceful degradation)
        }
      }
      
      // ⚡ SCALABILITY FIX: Limit at database level with pagination
      // ✅ CRITICAL: Filter out deleted conversations
      // ✅ PERFORMANCE: Load only 20 conversations initially (faster load)
      let conversations = await atlasDB.conversations
        .where('userId')
        .equals(user.id)
        .filter(conv => !conv.deletedAt) // ✅ Filter out soft-deleted conversations
        .reverse() // Most recent first
        .limit(20) // ✅ PERFORMANCE: Reduced from 50 to 20 for faster initial load
        .toArray();
      
      logger.debug(`[QuickActions] 📊 Found ${conversations.length} conversations in IndexedDB`);
      
      // ✅ FIX: If IndexedDB is empty (common on mobile/fresh browser), sync from Supabase FIRST
      if (conversations.length === 0) {
        logger.debug('[QuickActions] 📡 IndexedDB empty, syncing from Supabase...');
        try {
          const { conversationSyncService } = await import('../../services/conversationSyncService');
          // ✅ SYNC FIX: Empty IndexedDB should check for missing conversations too
          await conversationSyncService.deltaSync(user.id, true, true); // force=true, checkForMissing=true
          
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
    
    try {
      // ✅ FIX: Close sidebar immediately for better UX
      if (onNewChat) {
        onNewChat();
        logger.debug('[QuickActions] 🚪 Sidebar closed');
      }
      
      // ✅ Get authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        logger.error('[QuickActions] ❌ Cannot create conversation: not authenticated');
        toast.error('Please sign in to start a new chat');
        return;
      }
      
      // ✅ Create new conversation ID (browser-compatible)
      const newConversationId = generateUUID();
      logger.debug('[QuickActions] ✅ Generated new conversation ID:', newConversationId);
      
      // ✅ CRITICAL FIX: Create conversation record immediately (not wait for first message)
      // This ensures it appears in conversation history right away
      try {
        const { createConversation } = await import('../../utils/conversationService');
        const createdId = await createConversation(user.id, 'New Conversation');
        
        if (createdId) {
          logger.debug('[QuickActions] ✅ Conversation created in Supabase:', createdId);
          
          // ✅ Also save to local Dexie for immediate availability
          try {
            await atlasDB.conversations.put({
              id: createdId,
              userId: user.id,
              title: 'New Conversation',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            logger.debug('[QuickActions] ✅ Conversation saved to local Dexie');
          } catch (dexieError) {
            logger.warn('[QuickActions] ⚠️ Failed to save to Dexie (non-critical):', dexieError);
          }
          
          // ✅ Use the created ID (in case it differs)
          const finalId = createdId || newConversationId;
          
          // ✅ Refresh conversation list to show new conversation
          await refreshConversationList(true);
          
          // ✅ Navigate to new conversation
          const targetUrl = `/chat?conversation=${finalId}`;
          logger.debug('[QuickActions] 🔄 Navigating to:', targetUrl);
          
          navigate(targetUrl, { replace: true });
          
          logger.debug('[QuickActions] ✅ Navigation triggered via React Router');
          logger.debug('[QuickActions] ✅ Navigation complete');
        } else {
          // Fallback: Use generated ID if creation failed
          logger.warn('[QuickActions] ⚠️ Conversation creation returned null, using generated ID');
          navigate(`/chat?conversation=${newConversationId}`, { replace: true });
        }
      } catch (createError) {
        logger.error('[QuickActions] ❌ Failed to create conversation:', createError);
        // Fallback: Still navigate with generated ID (conversation will be created on first message)
        toast.error('Failed to create conversation. It will be created when you send your first message.');
        navigate(`/chat?conversation=${newConversationId}`, { replace: true });
      }
    } catch (error) {
      logger.error('[QuickActions] ❌ Error in handleNewChat:', error);
      toast.error('Failed to start new chat. Please try again.');
    }
  };

  const handleViewHistory = async () => {
    if (isLoadingHistory) return; // ✅ Prevent duplicate clicks
    
    setIsLoadingHistory(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logger.debug('[QuickActions] No authenticated user - cannot load history');
        toast.error('Please sign in to view your conversation history');
        setIsLoadingHistory(false);
        return;
      }

      logger.debug('[QuickActions] Loading conversations for user:', user.id);
      
      // ✅ FIX: Always force refresh to ensure mobile and web show same data
      const conversations = await refreshConversationList(true);
      
      // ✅ UX IMPROVEMENT: Show helpful message if no conversations
      if (!conversations || conversations.length === 0) {
        logger.debug('[QuickActions] No conversations found');
        // Still open modal to show empty state (better UX than silent failure)
      }
      
      logger.debug('[QuickActions] ✅ View History loaded with latest data');
    } catch (err) {
      logger.error('[QuickActions] Failed to load history:', err);
      toast.error('Failed to load conversation history. Please try again.', {
        duration: 5000,
        description: 'If this persists, try refreshing the page.',
      });
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

      // ✅ CRITICAL FIX: Refresh list AND update drawer if it's open
      await refreshConversationList(true);
      
      // ✅ CRITICAL FIX: Also trigger refresh in conversation history drawer if open
      if (onViewHistory) {
        const refreshedConversations = await refreshConversationList(true);
        onViewHistory({
          conversations: refreshedConversations || [],
          onDeleteConversation: handleDeleteConversation,
          deletingId: null,
          onRefresh: async () => {
            await refreshConversationList(true);
          }
        });
      }
      
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

  // ✅ REMOVED: Clear All Data moved to ProfileSettingsModal (Account section)

  return (
    <>
      <div className="p-4">
        <h3 className="text-sm font-medium text-[#8B7E74] dark:text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h3>
        <ul className="space-y-2">
          <li>
            <button
              onClick={handleNewChat}
              aria-label="Start a new conversation"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white bg-[#8FA67E] hover:bg-[#7E9570] dark:bg-[#F4E5D9] dark:hover:bg-[#F3D3B8] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[#8FA67E] dark:focus-visible:ring-[#F4E5D9] focus-visible:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
                <Plus className="w-4 h-4 text-white dark:text-[#8B7E74]" aria-hidden="true" />
              </div>
              <span className="font-medium dark:text-[#8B7E74]">Start New Chat</span>
            </button>
          </li>
          
          <li>
            <button
              onClick={handleViewHistory}
              disabled={isLoadingHistory}
              aria-label={isLoadingHistory ? 'Loading conversation history' : 'View conversation history'}
              aria-busy={isLoadingHistory}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#5A524A] dark:text-gray-300 bg-[#C6D4B0] dark:bg-gray-700 hover:bg-[#B8C6A2] dark:hover:bg-gray-600 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#8FA67E] dark:focus-visible:ring-gray-500 focus-visible:outline-none relative"
            >
              {/* ✅ UX IMPROVEMENT: Loading overlay for better visual feedback */}
              {isLoadingHistory && (
                <div className="absolute inset-0 bg-[#C6D4B0]/80 dark:bg-gray-700/80 rounded-xl flex items-center justify-center z-10">
                  <Loader2 className="w-5 h-5 text-[#5A524A] dark:text-gray-300 animate-spin" />
                </div>
              )}
              <div className="w-8 h-8 rounded-full bg-[#5A524A]/20 dark:bg-gray-300/20 flex items-center justify-center flex-shrink-0">
                {isLoadingHistory ? (
                  <Loader2 className="w-4 h-4 text-[#5A524A] dark:text-gray-300 animate-spin" aria-hidden="true" />
                ) : (
                  <History className="w-4 h-4 text-[#5A524A] dark:text-gray-300" aria-hidden="true" />
                )}
              </div>
              <span className="font-medium flex-1 text-left">
                {isLoadingHistory ? 'Loading History...' : 'View History'}
              </span>
            </button>
          </li>
        </ul>
      </div>

      {/* ✅ BEST PRACTICE: Custom confirmation dialogs */}
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
