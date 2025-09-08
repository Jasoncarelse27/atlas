import React from 'react';
import { FixedSizeList as List } from 'react-window';
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

const HistoryListBase: React.FC<HistoryListProps> = ({
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

  // Use virtualization for large lists
  if (items.length <= 50) {
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
  }

  // Virtualized list for large datasets
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = items[index];
    return (
      <div style={style}>
        <HistoryItemComponent
          item={item}
          onOpen={() => onOpen(item.id)}
          onDelete={onDelete ? () => onDelete(item.id) : undefined}
          onUpdateTitle={onUpdateTitle ? (title) => onUpdateTitle(item.id, title) : undefined}
          onPin={onPin ? (pinned) => onPin(item.id, pinned) : undefined}
          onSoundPlay={onSoundPlay}
        />
      </div>
    );
  };

  return (
    <List
      height={480}
      width="100%"
      itemSize={56}
      itemCount={items.length}
    >
      {Row}
    </List>
  );
};

const propsEqual = (a: HistoryListProps, b: HistoryListProps) =>
  a.items.length === b.items.length &&
  a.items.every((item, index) => 
    item.id === b.items[index]?.id &&
    item.title === b.items[index]?.title &&
    item.pinned === b.items[index]?.pinned &&
    item.updatedAt === b.items[index]?.updatedAt
  ) &&
  a.onOpen === b.onOpen &&
  a.onDelete === b.onDelete &&
  a.onUpdateTitle === b.onUpdateTitle &&
  a.onPin === b.onPin &&
  a.onSoundPlay === b.onSoundPlay;

export const HistoryList = React.memo(HistoryListBase, propsEqual);
export default HistoryList;
