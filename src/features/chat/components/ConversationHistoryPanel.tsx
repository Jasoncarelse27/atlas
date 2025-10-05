import {
  AlertTriangle,
  Check,
  Clock,
  Edit3,
  MessageSquare,
  Pin,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import Tooltip from '../../../components/Tooltip';
import type { SoundType } from '../../../hooks/useSoundEffects';
import type { Conversation } from '../../../types/chat';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when panel opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Focus edit input when editing
  useEffect(() => {
    if (editingConversationId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingConversationId]);

  // Filter conversations based on search query
  const filteredConversations = conversations.filter(conv => 
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort conversations: pinned first, then by lastUpdated
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    // Pinned conversations first
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    
    // Then sort by lastUpdated (most recent first)
    return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
  });

  const handleSelectConversation = (conversation: Conversation) => {
    if (onSoundPlay) onSoundPlay('click');
    onSelectConversation(conversation);
    onClose();
  };

  const handleCreateNewConversation = () => {
    if (onSoundPlay) onSoundPlay('click');
    onCreateNewConversation();
    onClose();
  };

  const handleStartEditing = (conversation: Conversation) => {
    if (onSoundPlay) onSoundPlay('click');
    setEditingConversationId(conversation.id);
    setEditTitle(conversation.title);
  };

  const handleSaveEdit = (conversationId: string) => {
    if (editTitle.trim()) {
      if (onSoundPlay) onSoundPlay('success');
      onUpdateConversationTitle(conversationId, editTitle.trim());
    }
    setEditingConversationId(null);
  };

  const handleCancelEdit = () => {
    if (onSoundPlay) onSoundPlay('click');
    setEditingConversationId(null);
  };

  const handleTogglePin = (conversationId: string, currentPinned: boolean) => {
    if (onSoundPlay) onSoundPlay('toggle');
    onPinConversation(conversationId, !currentPinned);
  };

  const handleConfirmDelete = (conversationId: string) => {
    if (onSoundPlay) onSoundPlay('click');
    setShowDeleteConfirm(conversationId);
  };

  const handleDeleteConversation = (conversationId: string) => {
    if (onSoundPlay) onSoundPlay('error');
    onDeleteConversation(conversationId);
    setShowDeleteConfirm(null);
  };

  const handleCancelDelete = () => {
    if (onSoundPlay) onSoundPlay('click');
    setShowDeleteConfirm(null);
  };


  const handleClearAllConversations = () => {
    if (onSoundPlay) onSoundPlay('error');
    onClearConversations();
    setShowClearConfirm(false);
  };

  const handleCancelClearAll = () => {
    if (onSoundPlay) onSoundPlay('click');
    setShowClearConfirm(false);
  };


  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Group conversations by date
  const groupedConversations: Record<string, Conversation[]> = {};
  
  sortedConversations.forEach(conv => {
    const dateGroup = formatDate(conv.lastUpdated);
    if (!groupedConversations[dateGroup]) {
      groupedConversations[dateGroup] = [];
    }
    groupedConversations[dateGroup].push(conv);
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center sm:items-center p-0 sm:p-4">
      <div 
        className="bg-gray-900/80 backdrop-blur-2xl shadow-2xl rounded-3xl border border-white/10 w-full max-w-sm mx-auto sm:max-w-md h-[80vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header - Enhanced glass effect */}
        <div className="px-4 py-3 sm:px-6 sm:py-5 bg-gradient-to-r from-white/15 to-white/5 backdrop-blur-xl rounded-t-3xl border-b border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/25 rounded-xl shadow-lg">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Conversation History</h2>
                <p className="text-sm text-white/80">Choose a conversation to continue</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200"
              aria-label="Close conversation history"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Search and New Chat */}
          <div className="mt-4 flex gap-2">
            <div className="flex-1 flex items-center rounded-xl overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20">
              <Search className="w-4 h-4 text-white/60 ml-3" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations"
                className="w-full p-2 border-0 bg-transparent text-white placeholder-white/60 focus:outline-none text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 mr-2 text-white/60 hover:text-white rounded-full hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <Tooltip content="New conversation">
              <button
                onClick={handleCreateNewConversation}
                className="p-2.5 bg-blue-600/90 hover:bg-blue-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                aria-label="New conversation"
              >
                <Plus className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {Object.keys(groupedConversations).length > 0 ? (
            <div className="p-2">
              {Object.entries(groupedConversations).map(([dateGroup, convs]) => (
                <div key={dateGroup} className="mb-4">
                  <h3 className="text-xs font-medium text-gray-400 px-2 py-1">{dateGroup}</h3>
                  
                  <div className="space-y-1">
                    {convs.map(conversation => (
                      <div key={conversation.id} className="relative">
                        {/* Delete Confirmation - Prominent and visible */}
                        {showDeleteConfirm === conversation.id && (
                          <div className="absolute inset-0 bg-red-500/95 backdrop-blur-sm rounded-xl border-2 border-red-400 z-10 p-3 flex flex-col shadow-2xl">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertTriangle className="w-5 h-5 text-white" />
                              <p className="text-sm font-medium text-white">Delete this conversation?</p>
                            </div>
                            <p className="text-xs text-red-100 mb-3">This action cannot be undone.</p>
                            <div className="flex gap-2 mt-auto">
                              <button
                                onClick={handleCancelDelete}
                                className="flex-1 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-all duration-200 border border-white/30"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDeleteConversation(conversation.id)}
                                className="flex-1 px-3 py-2 bg-white hover:bg-red-50 text-red-600 rounded-lg text-sm font-medium transition-all duration-200 shadow-lg"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Conversation Item - Modern design matching Attach Media popup */}
                        <div 
                          className={`group flex items-center w-full px-3 py-2 sm:px-4 sm:py-3 mx-2 rounded-xl text-left backdrop-blur-sm transition-all duration-200 ${
                            conversation.id === currentConversationId
                              ? 'bg-blue-500/20 border border-blue-400/40 shadow-lg'
                              : 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20'
                          }`}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Desktop: Right-click to delete
                            handleConfirmDelete(conversation.id);
                          }}
                          onTouchStart={(e) => {
                            // Long press to delete on mobile
                            const timer = setTimeout(() => {
                              handleConfirmDelete(conversation.id);
                            }, 500);
                            e.currentTarget.dataset.timer = timer.toString();
                          }}
                          onTouchEnd={(e) => {
                            const timer = e.currentTarget.dataset.timer;
                            if (timer) {
                              clearTimeout(parseInt(timer));
                              delete e.currentTarget.dataset.timer;
                            }
                          }}
                        >
                          {/* Editing Title */}
                          {editingConversationId === conversation.id ? (
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="neumorphic-input flex-1 px-2 py-1 border border-gray-300 rounded-lg text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveEdit(conversation.id);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEdit();
                                  }
                                }}
                              />
                              <button
                                onClick={() => handleSaveEdit(conversation.id)}
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
                              {/* Conversation Icon - Enhanced glass design */}
                              <div className="flex-shrink-0 mr-3">
                                <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                                  <MessageSquare className="w-4 h-4 text-white/80" />
                                </div>
                              </div>
                              
                              {/* Title and Timestamp */}
                              <div 
                                className="flex-1 cursor-pointer"
                                onClick={() => handleSelectConversation(conversation)}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  {conversation.pinned && (
                                    <Pin className="w-3 h-3 text-blue-400" />
                                  )}
                                  <h4 className="text-sm font-medium text-white truncate">
                                    {conversation.title}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-white/60">
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    {new Date(conversation.lastUpdated).toLocaleTimeString([], { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </span>
                                  <span className="text-white/40">•</span>
                                  <span>{conversation.messages.length} messages</span>
                                </div>
                              </div>
                              
                              {/* Right Arrow - Enhanced glass design */}
                              <div className="text-white/60 group-hover:text-white/80 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                              
                              {/* Desktop Hint - Right-click for options */}
                              <div className="hidden sm:block text-xs text-white/40 ml-2">
                                Right-click for options
                              </div>
                              
                              {/* Quick Delete Button - Mobile Only */}
                              <button
                                onClick={() => handleConfirmDelete(conversation.id)}
                                className="sm:hidden ml-3 p-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 rounded-xl transition-all duration-200 border-2 border-red-400/50 hover:border-red-300/70 shadow-lg hover:shadow-xl"
                                title="Delete conversation"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                              
                              {/* Action Buttons - Mobile Only */}
                              <div className="sm:hidden flex items-center gap-2 ml-2">
                                {/* Pin Button */}
                                <Tooltip content={conversation.pinned ? "Unpin" : "Pin"}>
                                  <button
                                    onClick={() => handleTogglePin(conversation.id, !!conversation.pinned)}
                                    className="p-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 hover:text-blue-200 rounded-lg transition-all duration-200 border border-blue-400/40"
                                  >
                                    <Pin className="w-4 h-4" />
                                  </button>
                                </Tooltip>
                                
                                {/* Edit Button */}
                                <Tooltip content="Edit title">
                                  <button
                                    onClick={() => handleStartEditing(conversation)}
                                    className="p-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 hover:text-yellow-200 rounded-lg transition-all duration-200 border border-yellow-400/40"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                </Tooltip>
                                
                                {/* Delete Button - Most prominent */}
                                <Tooltip content="Delete conversation">
                                  <button
                                    onClick={() => handleConfirmDelete(conversation.id)}
                                    className="p-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 rounded-lg transition-all duration-200 border-2 border-red-400/50 hover:border-red-300/70 shadow-lg"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </Tooltip>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="flex flex-col items-center justify-center h-40 p-4">
              <Search className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-gray-400 text-center">No conversations found matching "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 p-4">
              <MessageSquare className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-gray-400 text-center">No conversations yet</p>
              <button
                onClick={handleCreateNewConversation}
                className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                Start a new conversation
              </button>
            </div>
          )}
        </div>

        {/* Footer - Enhanced glass effect */}
        <div className="px-4 py-3 sm:px-6 sm:py-5 bg-gradient-to-r from-white/5 to-white/2 backdrop-blur-xl border-t border-white/10">
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-blue-600/90 hover:bg-blue-600 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Close
            </button>
          </div>
          
          {/* Clear All Confirmation */}
          {showClearConfirm && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">
                  Are you sure you want to delete all conversations? This cannot be undone.
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleCancelClearAll}
                  className="neumorphic-button flex-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAllConversations}
                  className="neumorphic-button flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                >
                  Delete All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationHistoryPanel;