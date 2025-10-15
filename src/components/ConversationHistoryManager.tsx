import { Clock, MessageSquare, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { conversationService } from '../services/conversationService';

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface ConversationHistoryManagerProps {
  onConversationSelect: (conversationId: string) => void;
  currentConversationId?: string;
}

export default function ConversationHistoryManager({
  onConversationSelect,
  currentConversationId
}: ConversationHistoryManagerProps) {
  const { user } = useSupabaseAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load conversations using unified service
  const loadConversations = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // ✅ PERFORMANCE: Use unified conversation service with caching
      const conversations = await conversationService.getConversations(user.id);

      // Transform to expected format
      const conversationsWithCounts = conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: 0 // Default value - no expensive query needed
      }));

      setConversations(conversationsWithCounts);
    } catch (error) {
      console.error('[ConversationHistoryManager] Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ BULLETPROOF: No sync to preserve deletions
  const syncConversations = async () => {
    if (!user) return;
    
    try {
      setIsSyncing(true);
      // ✅ CRITICAL FIX: Don't sync - this would restore deleted conversations!
      console.log('[ConversationHistoryManager] ✅ No sync to preserve deletions');
      await loadConversations(); // Just reload local data
    } catch (error) {
      console.error('[ConversationHistoryManager] Load failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete conversation
  const deleteConversation = async (conversationId: string) => {
    if (!user) return;
    
    try {
      await conversationService.deleteConversation(conversationId);
      await loadConversations(); // Reload after deletion
      
      // If we deleted the current conversation, clear selection
      if (conversationId === currentConversationId) {
        onConversationSelect('');
      }
    } catch (error) {
      console.error('[ConversationHistoryManager] Failed to delete conversation:', error);
    }
  };

  // Load conversations on mount and when user changes
  useEffect(() => {
    loadConversations();
  }, [user]);

  // Auto-sync every 5 minutes
  useEffect(() => {
    if (!user) return;
    
    const syncInterval = setInterval(() => {
      syncConversations();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(syncInterval);
  }, [user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="w-full h-full bg-gray-900/50 backdrop-blur-sm border-r border-gray-700/50">
      {/* Header */}
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Conversations</h2>
          <button
            onClick={syncConversations}
            disabled={isSyncing}
            className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
            title="Sync conversations"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {isSyncing && (
          <div className="text-sm text-blue-400 flex items-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Syncing conversations...
          </div>
        )}
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No conversations yet</p>
            <p className="text-sm">Start a new conversation to see it here</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                  conv.id === currentConversationId
                    ? 'bg-blue-600/20 border border-blue-500/30'
                    : 'bg-gray-800/30 hover:bg-gray-700/50 border border-transparent'
                }`}
                onClick={() => onConversationSelect(conv.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">
                      {conv.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(conv.updatedAt)}</span>
                      <span>•</span>
                      <span>{conv.messageCount} messages</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-600/20 text-red-400 hover:text-red-300 transition-all"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700/50">
        <div className="text-xs text-gray-500 text-center">
          Conversations sync across all your devices
        </div>
      </div>
    </div>
  );
}
