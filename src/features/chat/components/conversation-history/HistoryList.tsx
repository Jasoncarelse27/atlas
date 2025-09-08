import React from 'react';
import type { HistoryItem } from '../../hooks/useConversationHistory';
import HistoryItemComponent from './HistoryItem';

interface HistoryListProps {
  items: HistoryItem[];
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdateTitle?: (id: string, title: string) => void;
  onPin?: (id: string, pinned: boolean) => void;
  onSoundPlay?: (soundType: string) => void;
}

const HistoryList: React.FC<HistoryListProps> = ({
  items,
  onOpen,
  onDelete,
  onUpdateTitle,
  onPin,
  onSoundPlay,
}) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No conversations yet</p>
        <p className="text-sm text-gray-400 mt-1">Start a new conversation to see it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <HistoryItemComponent
          key={item.id}
          item={item}
          onOpen={() => onOpen(item.id)}
          onDelete={onDelete ? () => onDelete(item.id) : undefined}
          onUpdateTitle={onUpdateTitle ? (title) => onUpdateTitle(item.id, title) : undefined}
          onPin={onPin ? (pinned) => onPin(item.id, pinned) : undefined}
          onSoundPlay={onSoundPlay}
        />
      ))}
    </div>
  );
};

export default HistoryList;
