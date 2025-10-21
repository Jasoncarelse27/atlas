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
      
      // ⚡ SCALABILITY FIX: Limit at database level
      const conversations = await atlasDB.conversations
        .where('userId')
        .equals(user.id)
        .reverse() // Most recent first
        .limit(50) // Prevent memory overload
        .toArray();
      
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
      <div className="bg-slate-700/20 border border-slate-600/20 p-4 rounded-2xl shadow">
        <h3 className="text-white text-sm font-bold mb-4 tracking-wide">Quick Actions</h3>
        <ul className="space-y-2">
          {actions.map((action, index) => {
            const IconComponent = action.icon;
            return (
              <li key={index}>
                <button
                  onClick={action.action}
                  disabled={action.disabled}
                  className={`group w-full text-left p-3 rounded-xl transition-all duration-200 border flex items-center space-x-3 ${
                    action.disabled 
                      ? 'bg-slate-700/10 border-slate-600/10 cursor-not-allowed opacity-60' 
                      : 'bg-slate-700/30 hover:bg-slate-700/50 active:bg-slate-700/60 border-slate-600/30 hover:border-slate-500/50'
                  }`}
                >
                  <div className={`flex-shrink-0 p-2 rounded-xl bg-${action.color}-600/20 group-hover:bg-${action.color}-600/30 transition-colors`}>
                    <IconComponent className={`w-5 h-5 text-${action.color}-400 ${action.animate ? 'animate-spin' : ''}`} />
                  </div>
                  <span className={`text-sm font-medium transition-colors ${
                    action.disabled 
                      ? 'text-slate-400' 
                      : 'text-white group-hover:text-slate-100'
                  }`}>
                    {action.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

    </>
  );
}
