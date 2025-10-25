import { History, Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { atlasDB } from '../../database/atlasDB';
import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabaseClient';
import { deleteConversation } from '../../services/conversationDeleteService';
import { generateUUID } from '../../utils/uuid';

interface QuickActionsProps {
  onViewHistory?: (data: { 
    conversations: any[]; 
    onDeleteConversation: (id: string) => void; 
    deletingId: string | null;
    onRefresh: () => Promise<void>;
  }) => void;
}

export default function QuickActions({ onViewHistory }: QuickActionsProps) {
  const [, setDeletingId] = useState<string | null>(null); // Keep setter for future use
  const [, setConversations] = useState<any[]>([]); // State for UI updates
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
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
      
      // ⚡ SCALABILITY FIX: Limit at database level
      let conversations = await atlasDB.conversations
        .where('userId')
        .equals(user.id)
        .reverse() // Most recent first
        .limit(50) // Prevent memory overload
        .toArray();
      
      // ✅ FIX: If IndexedDB is empty (common on mobile/fresh browser), sync from Supabase first
      if (conversations.length === 0) {
        logger.debug('[QuickActions] 📡 IndexedDB empty, syncing from Supabase...');
        try {
          const { conversationSyncService } = await import('../../services/conversationSyncService');
          await conversationSyncService.deltaSync(user.id);
          
          // ✅ Read again after sync
          conversations = await atlasDB.conversations
            .where('userId')
            .equals(user.id)
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
    logger.debug('[QuickActions] Starting new chat...');
    
    // ✅ Create new conversation ID (browser-compatible)
    const newConversationId = generateUUID();
    logger.debug('[QuickActions] ✅ Generated new conversation ID:', newConversationId);
    
    // ✅ Navigate to new chat with new conversation ID
    const newChatUrl = `/chat?conversation=${newConversationId}`;
    logger.debug('[QuickActions] ✅ Navigating to:', newChatUrl);
    
    // ✅ Navigate to new chat
    window.location.href = newChatUrl;
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
      
      await refreshConversationList();
      
      logger.debug('[QuickActions] ✅ View History loaded instantly - background sync keeps data fresh');
    } catch (err) {
      logger.error('[QuickActions] Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    // Confirmation
    if (!window.confirm('🗑️ Delete this conversation?\n\nThis cannot be undone.')) {
      return;
    }

    setDeletingId(conversationId);
    
    try {
      // Get user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Please login again');

      // Simple delete using the clean service
      await deleteConversation(conversationId, user.id);

      // Refresh list after successful delete
      await refreshConversationList(true);
      
    } catch (err: any) {
      logger.error('[QuickActions] ❌ Delete failed:', err);
      alert(`Failed to delete:\n${err.message || 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearData = async () => {
    // Confirmation dialog
    if (!confirm('Clear All Data\n\nThis will clear all local conversations and cache. Your account data is safe on the server.\n\nContinue?')) {
      return;
    }

    try {
      logger.debug('[QuickActions] Clearing all local data...');
      
      // Import and call resetLocalData utility
      const { resetLocalData } = await import('@/utils/resetLocalData');
      await resetLocalData();
      
    } catch (err) {
      logger.error('[QuickActions] Failed to clear data:', err);
      alert('Failed to clear data. Please try again.');
    }
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
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white bg-[#8FA67E] hover:bg-[#7E9570] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" />
              </div>
              <span className="font-medium">Start New Chat</span>
            </button>
          </li>
          
          <li>
            <button
              onClick={handleViewHistory}
              disabled={isLoadingHistory}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#5A524A] bg-[#C6D4B0] hover:bg-[#B8C6A2] transition-colors disabled:opacity-60"
            >
              <div className="w-8 h-8 rounded-full bg-[#5A524A]/20 flex items-center justify-center">
                {isLoadingHistory ? (
                  <Loader2 className="w-4 h-4 text-[#5A524A] animate-spin" />
                ) : (
                  <History className="w-4 h-4 text-[#5A524A]" />
                )}
              </div>
              <span className="font-medium">{isLoadingHistory ? 'Loading...' : 'View History'}</span>
            </button>
          </li>
          
          <li>
            <button
              onClick={handleClearData}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#5A524A] bg-[#F0E6DC] hover:bg-[#E8DDD2] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#CF9A96]/30 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-[#A67571]" />
              </div>
              <span className="font-medium">Clear All Data</span>
            </button>
          </li>
        </ul>
      </div>

    </>
  );
}
