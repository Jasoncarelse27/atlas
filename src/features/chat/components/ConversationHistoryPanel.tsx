import { Plus, Trash2, X } from 'lucide-react';
import React from 'react';
import { useConversationHistory } from '../hooks/useConversationHistory';
import type { SoundType } from '../hooks/useSoundEffects';
import type { Conversation } from '../types/chat';
import { Filters, HistoryList } from './conversation-history';

interface ConversationHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onCreateNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onUpdateConversationTitle: (conversationId: string, title: string) => void;
  onPinConversation: (conversationId: string, pinned: boolean) => void;
  onClearConversations: () => void;
  onSoundPlay?: (soundType: SoundType) => void;
}

const ConversationHistoryPanel: React.FC<ConversationHistoryPanelProps> = ({
  isOpen,
  onClose,
  conversations,
  currentConversationId,
  onSelectConversation,
  onCreateNewConversation,
  onDeleteConversation,
  onUpdateConversationTitle,
  onPinConversation,
  onClearConversations,
  onSoundPlay
}) => {
  // Transform conversations to HistoryItem format
  const historyItems = conversations.map(conv => ({
    id: conv.id,
    title: conv.title,
    pinned: conv.pinned,
    updatedAt: conv.lastUpdated
  }));

  // Use the conversation history hook
  const { list, filters, setFilters } = useConversationHistory(historyItems);

  const handleOpenConversation = (id: string) => {
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
      onSelectConversation(conversation);
      onClose();
    }
  };

  const handleCreateNew = () => {
    if (onSoundPlay) onSoundPlay('click');
    onCreateNewConversation();
    onClose();
  };

  const handleClearAll = () => {
    if (onSoundPlay) onSoundPlay('click');
    if (window.confirm('Are you sure you want to clear all conversations? This cannot be undone.')) {
      onClearConversations();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Conversation History
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateNew}
              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              title="New Conversation"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={handleClearAll}
              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear All"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filters */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <Filters
              value={filters}
              onChange={setFilters}
              onSoundPlay={onSoundPlay}
            />
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto p-6">
            <HistoryList
              items={list}
              onOpen={handleOpenConversation}
              onDelete={onDeleteConversation}
              onUpdateTitle={onUpdateConversationTitle}
              onPin={onPinConversation}
              onSoundPlay={onSoundPlay}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationHistoryPanel;