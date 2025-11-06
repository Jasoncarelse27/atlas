import {
    Check,
    Clock,
    Edit3,
    MessageSquare,
    MoreVertical,
    Pin,
    Trash2,
    X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import Tooltip from '../components/Tooltip';
import type { SoundType } from '../hooks/useSoundEffects';
import type { Conversation } from '../types/chat';

interface ConversationItemProps {
  conversation: Conversation;
  isCurrent: boolean;
  onSelect: (conversation: Conversation) => void;
  onUpdateTitle: (conversationId: string, title: string) => void;
  onTogglePin: (conversationId: string, pinned: boolean) => void;
  onDelete: (conversationId: string) => void;
  onSoundPlay?: (soundType: SoundType) => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isCurrent,
  onSelect,
  onUpdateTitle,
  onTogglePin,
  onDelete,
  onSoundPlay
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Focus edit input when editing starts
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [isEditing]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showContextMenu]);

  const handleStartEditing = () => {
    if (onSoundPlay) onSoundPlay('click');
    setIsEditing(true);
    setEditTitle(conversation.title);
  };

  const handleSaveEdit = () => {
    if (editTitle.trim()) {
      if (onSoundPlay) onSoundPlay('success');
      onUpdateTitle(conversation.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    if (onSoundPlay) onSoundPlay('click');
    setIsEditing(false);
    setEditTitle(conversation.title);
  };

  const handleTogglePin = () => {
    if (onSoundPlay) onSoundPlay('toggle');
    onTogglePin(conversation.id, !!conversation.pinned);
  };

  const handleConfirmDelete = () => {
    if (onSoundPlay) onSoundPlay('click');
    setShowDeleteConfirm(true);
  };

  const handleDelete = () => {
    if (onSoundPlay) onSoundPlay('error');
    onDelete(conversation.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    if (onSoundPlay) onSoundPlay('click');
    setShowDeleteConfirm(false);
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleLongPress = () => {
    setShowContextMenu(true);
  };

  const handleLongPressStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const timer = setTimeout(() => {
      handleLongPress();
    }, 500); // 500ms long press
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleContextMenuAction = (action: string) => {
    setShowContextMenu(false);
    switch (action) {
      case 'edit':
        handleStartEditing();
        break;
      case 'pin':
        handleTogglePin();
        break;
      case 'delete':
        handleConfirmDelete();
        break;
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (showDeleteConfirm) {
    return (
      <div className="absolute inset-0 bg-white rounded-lg border border-red-200 z-10 p-3 flex flex-col">
        <p className="text-sm text-gray-700 mb-3">Delete this conversation?</p>
        <div className="flex gap-2 mt-auto">
          <button
            onClick={handleCancelDelete}
            className="neumorphic-button flex-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="neumorphic-button flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div 
        className={`group p-2 rounded-lg transition-colors flex items-center gap-2 ${
          isCurrent
            ? 'neumorphic-inner bg-atlas-pearl text-atlas-text-dark'
            : 'neumorphic-flat hover:bg-gray-100'
        }`}
        onContextMenu={handleContextMenu}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onTouchMove={handleLongPressEnd}
      >
        {/* Editing Title */}
        {isEditing ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              ref={editInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="neumorphic-input flex-1 px-2 py-1 border border-gray-300 rounded-lg text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveEdit();
                } else if (e.key === 'Escape') {
                  handleCancelEdit();
                }
              }}
            />
            <button
              onClick={handleSaveEdit}
              className="neumorphic-button p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="neumorphic-button p-1 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Conversation Icon */}
            <div className={`p-1.5 rounded-lg ${
              isCurrent
                ? 'bg-atlas-peach text-atlas-text-dark'
                : 'bg-gray-200 text-gray-700'
            }`}>
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            
            {/* Title and Timestamp */}
            <div 
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => onSelect(conversation)}
            >
              <div className="flex items-center gap-1">
                {conversation.pinned && (
                  <Pin className="w-3 h-3 text-atlas-sage" />
                )}
                <h4 className="font-medium text-sm truncate">
                  {conversation.title}
                </h4>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{formatTime(conversation.lastUpdated)}</span>
                <span className="text-gray-400">•</span>
                <span>{conversation.messages.length} messages</span>
              </div>
            </div>
            
            {/* Action Buttons - Smaller for mobile */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Desktop hint - right-click */}
              <div className="hidden sm:block">
                <Tooltip content="Right-click for more options">
                  <button className="p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors">
                    <MoreVertical className="w-3 h-3" />
                  </button>
                </Tooltip>
              </div>
              
              {/* Mobile hint - long press */}
              <div className="sm:hidden">
                <Tooltip content="Long press for more options">
                  <button className="p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors">
                    <MoreVertical className="w-3 h-3" />
                  </button>
                </Tooltip>
              </div>
              <Tooltip content={conversation.pinned ? "Unpin" : "Pin"}>
                <button
                  onClick={handleTogglePin}
                  className="neumorphic-button p-1 text-gray-500 hover:text-atlas-sage hover:bg-atlas-pearl rounded-md transition-colors"
                >
                  <Pin className="w-3 h-3" />
                </button>
              </Tooltip>
              
              <Tooltip content="Edit title">
                <button
                  onClick={handleStartEditing}
                  className="neumorphic-button p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </Tooltip>
              
              <Tooltip content="Delete">
                <button
                  onClick={handleConfirmDelete}
                  className="neumorphic-button p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </Tooltip>
            </div>
          </>
        )}
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]"
          style={{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
          }}
        >
          <button
            onClick={() => handleContextMenuAction('edit')}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" />
            Edit Title
          </button>
          <button
            onClick={() => handleContextMenuAction('pin')}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <Pin className="w-4 h-4" />
            {conversation.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            onClick={() => handleContextMenuAction('delete')}
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default ConversationItem;
