import { useEffect, useState } from 'react';
import { logger } from '../../lib/logger';
import { supabase } from '../../lib/supabaseClient';
import { conversationService } from '../../services/conversationService';
import { generateUUID } from '../../utils/uuid';

interface QuickActionsProps {
  onViewHistory?: (data: {
    conversations: any[];
    onDeleteConversation: (id: string) => void;
    deletingId: string | null;
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
            deletingId: null
          });
        }
        return cachedConversations;
      }

      logger.debug('[QuickActions] 🔄 Fetching fresh conversations from database');
      
      // ✅ PERFORMANCE: Use unified conversation service
      const conversations = await conversationService.getConversations(user.id);
      
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
          deletingId: null
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
    // Simple confirmation dialog
    if (!confirm('Delete Conversation\n\nAre you sure you want to delete this conversation? This cannot be undone.')) {
      return;
    }

    // ✅ Set loading state - show spinner on delete button
    setDeletingId(conversationId);
    
    try {
      // ✅ Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      // ✅ Optimistic update - remove from UI immediately
      let updatedConversations: any[] = [];
      setConversations(prev => {
        updatedConversations = prev.filter(c => c.id !== conversationId);
        return updatedConversations;
      });
      
      // Update modal immediately with the filtered list
      if (onViewHistory) {
        onViewHistory({
          conversations: updatedConversations,
          onDeleteConversation: handleDeleteConversation,
          deletingId: null
        });
      }

      // ✅ Use unified conversation service
      await conversationService.deleteConversation(conversationId);
      
      logger.debug('[QuickActions] ✅ Conversation deleted successfully');
      
    } catch (err) {
      logger.error('[QuickActions] ❌ Failed to delete conversation:', err);
      alert('Failed to delete conversation. Please try again.');
      // ✅ Rollback on error - reload from database
      await refreshConversationList();
    } finally {
      // ✅ Clear loading state
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
    { icon: '➕', label: 'Start New Chat', action: handleNewChat },
    { 
      icon: isLoadingHistory ? '⏳' : '📜', 
      label: isLoadingHistory ? 'Loading...' : 'View History', 
      action: handleViewHistory,
      disabled: isLoadingHistory
    },
    { icon: '🗑️', label: 'Clear All Data', action: handleClearData }
  ];

  return (
    <>
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-4 rounded-2xl border border-gray-700/50 shadow-xl backdrop-blur-sm">
        <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 text-sm font-bold mb-4 tracking-wide">Quick Actions</h3>
        <ul className="space-y-2">
          {actions.map((action, index) => (
            <li key={index}>
              <button
                onClick={action.action}
                disabled={action.disabled}
                className={`group w-full text-left backdrop-blur-sm p-3 rounded-xl transition-all duration-300 border shadow-md flex items-center space-x-3 ${
                  action.disabled 
                    ? 'bg-gray-800/40 border-gray-600/30 cursor-not-allowed opacity-60' 
                    : 'bg-gradient-to-br from-gray-800/80 to-gray-800/60 hover:from-gray-700/80 hover:to-gray-700/60 active:scale-[0.98] border-gray-700/50 hover:border-gray-600/50 hover:shadow-lg'
                }`}
              >
                <div className="flex-shrink-0 w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                  <span className="text-lg">{action.icon}</span>
                </div>
                <span className={`text-sm font-medium transition-colors ${
                  action.disabled 
                    ? 'text-gray-400' 
                    : 'text-white group-hover:text-blue-100'
                }`}>
                  {action.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

    </>
  );
}
