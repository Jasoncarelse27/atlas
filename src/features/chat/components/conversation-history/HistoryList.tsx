import React from 'react';
import type { Conversation } from '../../../types/chat';
import HistoryItem from './HistoryItem';

interface HistoryListProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onDeleteConversation: (conversationId: string) => void;
  onUpdateConversationTitle: (conversationId: string, title: string) => void;
  onPinConversation: (conversationId: string, pinned: boolean) => void;
  onSoundPlay?: (soundType: string) => void;
}

const HistoryList: React.FC<HistoryListProps> = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onUpdateConversationTitle,
  onPinConversation,
  onSoundPlay,
}) => {
  if (conversations.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No conversations yet</p>
        <p className="text-sm text-gray-400 mt-1">Start a new conversation to see it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {conversations.map((conversation) => (
        <HistoryItem
          key={conversation.id}
          conversation={conversation}
          isActive={conversation.id === currentConversationId}
          onSelect={() => onSelectConversation(conversation)}
          onDelete={() => onDeleteConversation(conversation.id)}
          onUpdateTitle={(title) => onUpdateConversationTitle(conversation.id, title)}
          onPin={(pinned) => onPinConversation(conversation.id, pinned)}
          onSoundPlay={onSoundPlay}
        />
      ))}
    </div>
  );
};

export default HistoryList;
