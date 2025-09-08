import { Check, Edit3, MessageSquare, Pin, PinOff, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import type { HistoryItem } from '../../hooks/useConversationHistory';

interface HistoryItemProps {
  item: HistoryItem;
  onOpen: () => void;
  onDelete?: () => void;
  onUpdateTitle?: (title: string) => void;
  onPin?: (pinned: boolean) => void;
  onSoundPlay?: (soundType: string) => void;
}

const HistoryItemBase: React.FC<HistoryItemProps> = ({
  item,
  onOpen,
  onDelete,
  onUpdateTitle,
  onPin,
  onSoundPlay,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);

  const handleStartEdit = () => {
    setEditTitle(item.title);
    setIsEditing(true);
    if (onSoundPlay) {
      onSoundPlay('click');
    }
  };

  const handleSaveEdit = () => {
    if (editTitle.trim() && editTitle !== item.title && onUpdateTitle) {
      onUpdateTitle(editTitle.trim());
    }
    setIsEditing(false);
    if (onSoundPlay) {
      onSoundPlay('success');
    }
  };

  const handleCancelEdit = () => {
    setEditTitle(item.title);
    setIsEditing(false);
    if (onSoundPlay) {
      onSoundPlay('click');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

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
    <div
      className="group relative p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 border border-transparent"
      onClick={onOpen}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <MessageSquare className="w-4 h-4 text-gray-500" />
        </div>
        
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyPress}
              onBlur={handleSaveEdit}
              className="w-full text-sm font-medium bg-white border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {item.title}
            </h3>
          )}
          
          <p className="text-xs text-gray-500 mt-1">
            {formatDate(item.updatedAt)}
          </p>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {item.pinned ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPin?.(false);
                if (onSoundPlay) {
                  onSoundPlay('click');
                }
              }}
              className="p-1 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-100 rounded"
              title="Unpin conversation"
            >
              <Pin className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPin?.(true);
                if (onSoundPlay) {
                  onSoundPlay('click');
                }
              }}
              className="p-1 text-gray-400 hover:text-yellow-600 hover:bg-yellow-100 rounded"
              title="Pin conversation"
            >
              <PinOff className="w-3 h-3" />
            </button>
          )}

          {isEditing ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveEdit();
                }}
                className="p-1 text-green-600 hover:text-green-700 hover:bg-green-100 rounded"
                title="Save changes"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelEdit();
                }}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded"
                title="Cancel editing"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStartEdit();
              }}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded"
              title="Edit title"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )}

          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
                if (onSoundPlay) {
                  onSoundPlay('click');
                }
              }}
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded"
              title="Delete conversation"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const propsEqual = (a: HistoryItemProps, b: HistoryItemProps) =>
  a.item.id === b.item.id &&
  a.item.title === b.item.title &&
  a.item.pinned === b.item.pinned &&
  a.item.updatedAt === b.item.updatedAt &&
  a.onOpen === b.onOpen &&
  a.onDelete === b.onDelete &&
  a.onUpdateTitle === b.onUpdateTitle &&
  a.onPin === b.onPin &&
  a.onSoundPlay === b.onSoundPlay;

const HistoryItem = React.memo(HistoryItemBase, propsEqual);
export default HistoryItem;
