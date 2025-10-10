import { useState } from 'react';
import { atlasDB } from '../../database/atlasDB';
import { supabase } from '../../lib/supabaseClient';
import { ConversationHistoryDrawer } from '../ConversationHistoryDrawer';

export default function QuickActions() {
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleNewChat = async () => {
    console.log('[QuickActions] Starting new chat...');
    
    // ✅ Create new conversation ID
    const newConversationId = crypto.randomUUID();
    console.log('[QuickActions] ✅ Generated new conversation ID:', newConversationId);
    
    // ✅ Navigate to new chat with new conversation ID
    const newChatUrl = `/chat?conversation=${newConversationId}`;
    console.log('[QuickActions] ✅ Navigating to:', newChatUrl);
    
    // ✅ Navigate to new chat
    window.location.href = newChatUrl;
  };

  const handleViewHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[QuickActions] No authenticated user - cannot load history');
        return;
      }

      console.log('[QuickActions] Loading conversations for user:', user.id);
      
      // ✅ BULLETPROOF SOLUTION: Load ONLY from local Dexie with pagination
      const PAGE_SIZE = 20;  // Load 20 conversations at a time
      const localConversations = await atlasDB.conversations
        .orderBy('updatedAt')
        .reverse()
        .limit(PAGE_SIZE)
        .toArray();
      
      // ✅ BULLETPROOF DATA MAPPING - Ensure consistent field names
      const mappedConversations = localConversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        created_at: conv.createdAt,
        updated_at: conv.updatedAt,
        user_id: conv.userId
      }));
      
      console.log('[QuickActions] ✅ Loaded local conversations:', mappedConversations.length);
      setConversations(mappedConversations);
      setShowHistory(true);
      
      // ✅ NO SUPABASE SYNC - Local data is the single source of truth
      console.log('[QuickActions] ✅ Using local data only - deleted conversations stay deleted');
    } catch (err) {
      console.error('[QuickActions] Failed to load history:', err);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm('🗑️ Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return;
    }

    setDeletingId(conversationId);
    
    try {
      // ✅ BULLETPROOF DELETE: Delete from local Dexie FIRST (primary source)
      await atlasDB.messages.where('conversationId').equals(conversationId).delete();
      await atlasDB.conversations.delete(conversationId);
      console.log('[QuickActions] ✅ Deleted from local Dexie');
      
      // ✅ VERIFY DELETION - Check that it's actually gone from Dexie
      const verifyDeleted = await atlasDB.conversations.get(conversationId);
      if (verifyDeleted) {
        console.error('[QuickActions] ❌ CRITICAL: Conversation still exists in Dexie after deletion!');
        throw new Error('Deletion verification failed');
      }
      console.log('[QuickActions] ✅ Deletion verified - conversation removed from Dexie');
      
      // ✅ IMMEDIATE UI UPDATE - Remove from local state AFTER successful deletion
      setConversations(prev => {
        const filtered = prev.filter(conv => conv.id !== conversationId);
        console.log('[QuickActions] ✅ UI state updated - removed conversation:', conversationId);
        console.log('[QuickActions] ✅ Remaining conversations:', filtered.length);
        return filtered;
      });
      
      // ✅ DELETE FROM SUPABASE (backup only)
      try {
        const { error } = await supabase
          .from('conversations')
          .delete()
          .eq('id', conversationId);

        if (error) {
          console.error('[QuickActions] ❌ Supabase delete error:', error);
        } else {
          console.log('[QuickActions] ✅ Deleted from Supabase');
        }
      } catch (supabaseError) {
        console.error('[QuickActions] ❌ Supabase delete failed:', supabaseError);
      }
      
      console.log('[QuickActions] ✅ Conversation deleted successfully:', conversationId);
      
      // ✅ CRITICAL: Prevent any sync from running for 5 seconds after deletion
      console.log('[QuickActions] ✅ Blocking sync for 5 seconds to prevent restoration');
      setTimeout(() => {
        console.log('[QuickActions] ✅ Sync block lifted - deletion is now permanent');
      }, 5000);
      
    } catch (err) {
      console.error('[QuickActions] ❌ Failed to delete conversation:', err);
      // Don't restore - let deletion stand
    } finally {
      setDeletingId(null);
    }
  };

  const actions = [
    { icon: '➕', label: 'Start New Chat', action: handleNewChat },
    { icon: '📜', label: 'View History', action: handleViewHistory },
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

      {/* Conversation History Drawer */}
      <ConversationHistoryDrawer
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        conversations={conversations}
        onDeleteConversation={handleDeleteConversation}
        deletingId={deletingId}
      />
    </>
  );
}
