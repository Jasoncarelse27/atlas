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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]); // State for UI updates

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

  const refreshConversationList = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const PAGE_SIZE = 20;
      // ✅ Load only what we need - no overfetch
      const localConversations = await atlasDB.conversations
        .orderBy('updatedAt')
        .reverse()
        .limit(PAGE_SIZE)  // Changed from PAGE_SIZE * 2
        .toArray();
      
      // ✅ Map directly - no slicing needed
      const mappedConversations = localConversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        created_at: conv.createdAt,
        updated_at: conv.updatedAt,
        user_id: conv.userId
      }));
      
      setConversations(mappedConversations);
      
      // Update modal if it's open
      if (onViewHistory) {
        onViewHistory({
          conversations: mappedConversations,
          onDeleteConversation: handleDeleteConversation,
          deletingId: null
        });
      }
      
      logger.debug('[QuickActions] ✅ Conversation list refreshed');
    } catch (error) {
      logger.error('[QuickActions] ❌ Failed to refresh conversation list:', error);
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

      // ✅ Delete from database (both Supabase and local Dexie)
      await deleteConversation(conversationId, user.id);
      
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
    { icon: '📜', label: 'View History', action: handleViewHistory },
    { icon: '🗑️', label: 'Clear All Data', action: handleClearData }
  ];

  return (
    <>
      <div className="bg-[#2c2f36] p-4 rounded-lg shadow">
        <h3 className="text-gray-300 text-sm font-medium mb-3">Quick Actions</h3>
        <ul className="space-y-2">
          {actions.map((action, index) => (
            <li key={index}>
              <button
                onClick={action.action}
                className="w-full text-left text-gray-200 hover:text-white hover:bg-gray-700/50 p-2 rounded-md transition-colors duration-200 flex items-center space-x-2"
              >
                <span className="text-lg">{action.icon}</span>
                <span className="text-sm">{action.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

    </>
  );
}
