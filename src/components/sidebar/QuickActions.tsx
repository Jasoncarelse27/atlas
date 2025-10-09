import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { atlasDB } from '../../database/atlasDB';
import { startBackgroundSync } from '../../services/syncService';
import { ConversationHistoryDrawer } from '../ConversationHistoryDrawer';

export default function QuickActions() {
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleNewChat = async () => {
    // ✅ Navigate to clean URL (removes conversation ID param)
    // Backend will auto-create new conversation with title from first message
    window.history.pushState({}, '', '/chat');
    
    // ✅ Reload to reset state cleanly (future: could use React Router)
    window.location.reload();
  };

  const handleViewHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[QuickActions] No authenticated user - cannot load history');
        return;
      }

      console.log('[QuickActions] Loading conversations for user:', user.id);
      
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[QuickActions] Error loading conversations:', error);
        return;
      }

      console.log('[QuickActions] Loaded conversations:', data?.length || 0);
      setConversations(data || []);
      setShowHistory(true);
      
      // Trigger a quick sync to pick up changes from other devices
      try {
        console.log('[QuickActions] Triggering sync to pick up changes from other devices');
        startBackgroundSync(user.id, 'core');
      } catch (syncError) {
        console.log('[QuickActions] Sync trigger failed (non-critical):', syncError);
      }
    } catch (err) {
      console.error('[QuickActions] Failed to load history:', err);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm('🗑 Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return;
    }

    setDeletingId(conversationId);
    
    try {
      // Delete from Dexie (local)
      await atlasDB.messages.where('conversationId').equals(conversationId).delete();
      await atlasDB.conversations.delete(conversationId);
      
      // Delete from Supabase (cloud)
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) {
        console.error('[QuickActions] Supabase delete error:', error);
      }

      // Update local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // Trigger sync to update other devices
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('[QuickActions] Triggering sync after deletion');
          startBackgroundSync(user.id, 'core'); // Default to core for sync
        }
      } catch (syncError) {
        console.log('[QuickActions] Sync trigger failed (non-critical):', syncError);
      }
      
      console.log('[QuickActions] Conversation deleted successfully:', conversationId);
    } catch (err) {
      console.error('[QuickActions] Failed to delete conversation:', err);
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
