import { useState } from 'react';
import { atlasDB } from '../../database/atlasDB';
import { useUpgradeFlow } from '../../hooks/useUpgradeFlow';
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
  const { openUpgradeModal } = useUpgradeFlow();

  const handleNewChat = async () => {
    console.log('[QuickActions] Starting new chat...');
    
    // ✅ Create new conversation ID (browser-compatible)
    const newConversationId = generateUUID();
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
      
      // ✅ FAST HISTORY LOAD: Load directly from local Dexie (background sync keeps it updated)
      console.log('[QuickActions] 🚀 Loading conversation history from local Dexie...');
      
      // ✅ Load from local Dexie (background sync keeps it up-to-date)
      const PAGE_SIZE = 20;  // Load 20 conversations at a time
      const localConversations = await atlasDB.conversations
        .orderBy('updatedAt')
        .reverse()
        .limit(PAGE_SIZE * 2)  // Load extra to account for deleted ones
        .toArray();
      
      // ✅ Filter out deleted conversations
      const activeConversations = localConversations
        .filter(conv => !conv.deletedAt)
        .slice(0, PAGE_SIZE);
      
      // ✅ BULLETPROOF DATA MAPPING - Ensure consistent field names
      const mappedConversations = activeConversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        created_at: conv.createdAt,
        updated_at: conv.updatedAt,
        user_id: conv.userId
      }));
      
      console.log('[QuickActions] ✅ Loaded conversations instantly from local:', mappedConversations.length);
      
      // ✅ Call parent callback to show history modal with data
      if (onViewHistory) {
        onViewHistory({
          conversations: mappedConversations,
          onDeleteConversation: handleDeleteConversation,
          deletingId
        });
      }
      
      console.log('[QuickActions] ✅ View History loaded instantly - background sync keeps data fresh');
    } catch (err) {
      console.error('[QuickActions] Failed to load history:', err);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm('🗑️ Are you sure you want to delete this conversation?')) {
      return;
    }

    setDeletingId(conversationId);
    
    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[QuickActions] No authenticated user found');
        return;
      }

      // ✅ TIER-BASED DELETION: Use centralized service
      const result = await deleteConversation(conversationId, user.id);
      
      console.log(`[QuickActions] ✅ ${result.message}`);
      
      // ✅ UPGRADE PROMPTS: Show tier-specific upgrade opportunities
      if (result.tier === 'free') {
        // Free users: Prompt to upgrade to Core for cloud sync
        setTimeout(() => {
          if (confirm('💡 Upgrade to Core ($19.99/mo) to sync deletions across all your devices?\n\nWith Core, deleted conversations stay deleted everywhere.')) {
            openUpgradeModal('general');
          }
        }, 500);
      } else if (result.tier === 'core') {
        // Core users: Prompt to upgrade to Studio for restore capability
        setTimeout(() => {
          if (confirm('💡 Upgrade to Studio ($179.99/mo) to restore deleted conversations?\n\nWith Studio, you can recover accidentally deleted chats anytime.')) {
            openUpgradeModal('general');
          }
        }, 500);
      }
      
    } catch (err) {
      console.error('[QuickActions] ❌ Failed to delete conversation:', err);
      alert('Failed to delete conversation. Please try again.');
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

    </>
  );
}
