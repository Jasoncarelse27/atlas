import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  Edit3,
  MessageSquare,
  MoreVertical,
  Pin,
  Plus,
  Search,
  Trash,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import Tooltip from '../../components/Tooltip';
import type { SoundType } from '../../hooks/useSoundEffects';
import type { Conversation } from '../../types/chat';

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
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleConfirmClearAll = () => {
    if (onSoundPlay) onSoundPlay('click');
    setShowClearConfirm(true);
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

  const handleExportConversations = () => {
    setIsExporting(true);
    if (onSoundPlay) onSoundPlay('click');
    
    try {
      const dataStr = JSON.stringify(conversations, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
      
      const exportFileName = `atlas-conversations-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileName);
      linkElement.click();
      
      if (onSoundPlay) onSoundPlay('success');
    } catch (error) {
      console.error('Failed to export conversations:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    if (onSoundPlay) onSoundPlay('click');
    fileInputRef.current?.click();
  };

  const handleImportConversations = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedConversations = JSON.parse(content) as Conversation[];
        
        // Validate the imported data
        if (!Array.isArray(importedConversations)) {
          throw new Error('Invalid format: Expected an array of conversations');
        }
        
        // TODO: Add more validation and actually import the conversations
        console.log('Would import conversations:', importedConversations);
        
        if (onSoundPlay) onSoundPlay('success');
      } catch (error) {
        console.error('Failed to import conversations:', error);
        if (onSoundPlay) onSoundPlay('error');
      } finally {
        setIsImporting(false);
        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    
    reader.onerror = () => {
      console.error('Failed to read file');
      setIsImporting(false);
      if (onSoundPlay) onSoundPlay('error');
    };
    
    reader.readAsText(file);
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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-start justify-center sm:items-center p-0 sm:p-4">
      <div 
        className="bg-gray-800/95 backdrop-blur-xl shadow-2xl rounded-2xl border border-gray-600/50 w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 border-b border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Conversation History</h2>
                <p className="text-sm text-blue-100">{conversations.length} conversations</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white rounded-lg transition-colors"
              aria-label="Close conversation history"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Search and New Chat */}
          <div className="mt-4 flex gap-2">
            <div className="flex-1 flex items-center rounded-lg overflow-hidden bg-gray-700/50 border border-gray-600">
              <Search className="w-4 h-4 text-gray-400 ml-3" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations"
                className="w-full p-2 border-0 bg-transparent text-white placeholder-gray-400 focus:outline-none text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 mr-2 text-gray-400 hover:text-gray-300 rounded-full hover:bg-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <Tooltip content="New conversation">
              <button
                onClick={handleCreateNewConversation}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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
                        {/* Delete Confirmation - Smaller buttons */}
                        {showDeleteConfirm === conversation.id && (
                          <div className="absolute inset-0 bg-white rounded-lg border border-red-200 z-10 p-2 flex flex-col">
                            <p className="text-xs text-gray-700 mb-2">Delete this conversation?</p>
                            <div className="flex gap-1 mt-auto">
                              <button
                                onClick={handleCancelDelete}
                                className="neumorphic-button flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDeleteConversation(conversation.id)}
                                className="neumorphic-button flex-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Conversation Item */}
                        <div 
                          className={`group flex items-center w-full px-6 py-4 text-left hover:bg-gray-700/50 transition-colors duration-200 ${
                            conversation.id === currentConversationId
                              ? 'bg-blue-600/20 border-l-4 border-blue-500'
                              : ''
                          }`}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            // Simple right-click to delete for now
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
                              {/* Conversation Icon */}
                              <div className="flex-shrink-0 mr-4 group-hover:scale-110 transition-transform duration-200">
                                <MessageSquare className="w-8 h-8 text-blue-600" />
                              </div>
                              
                              {/* Title and Timestamp */}
                              <div 
                                className="flex-1 cursor-pointer"
                                onClick={() => handleSelectConversation(conversation)}
                              >
                                <div className="flex items-center gap-2">
                                  {conversation.pinned && (
                                    <Pin className="w-4 h-4 text-blue-500" />
                                  )}
                                  <h4 className="text-base font-medium text-gray-100 group-hover:text-white truncate">
                                    {conversation.title}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-400 group-hover:text-gray-300 mt-1">
                                  <Clock className="w-4 h-4" />
                                  <span>
                                    {new Date(conversation.lastUpdated).toLocaleTimeString([], { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </span>
                                  <span className="text-gray-500">•</span>
                                  <span>{conversation.messages.length} messages</span>
                                </div>
                              </div>
                              
                              {/* Right Arrow */}
                              <div className="text-gray-500 group-hover:text-gray-300 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                              
                              {/* Action Buttons - Smaller for mobile */}
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* Mobile hint */}
                                <div className="sm:hidden">
                                  <Tooltip content="Long press for more options">
                                    <div className="p-1 text-gray-400">
                                      <MoreVertical className="w-3 h-3" />
                                    </div>
                                  </Tooltip>
                                </div>
                                <Tooltip content={conversation.pinned ? "Unpin" : "Pin"}>
                                  <button
                                    onClick={() => handleTogglePin(conversation.id, !!conversation.pinned)}
                                    className="neumorphic-button p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                  >
                                    <Pin className="w-3 h-3" />
                                  </button>
                                </Tooltip>
                                
                                <Tooltip content="Edit title">
                                  <button
                                    onClick={() => handleStartEditing(conversation)}
                                    className="neumorphic-button p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                </Tooltip>
                                
                                <Tooltip content="Delete">
                                  <button
                                    onClick={() => handleConfirmDelete(conversation.id)}
                                    className="neumorphic-button p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
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

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-700/30 border-t border-gray-600">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Tooltip content="Export conversations">
                <button
                  onClick={handleExportConversations}
                  disabled={isExporting || conversations.length === 0}
                  className="neumorphic-button p-2 text-gray-600 hover:text-gray-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isExporting ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </button>
              </Tooltip>
              
              <Tooltip content="Import conversations">
                <button
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className="neumorphic-button p-2 text-gray-600 hover:text-gray-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isImporting ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                </button>
              </Tooltip>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportConversations}
                className="hidden"
              />
            </div>
            
            <Tooltip content="Clear all conversations">
              <button
                onClick={handleConfirmClearAll}
                disabled={conversations.length === 0}
                className="neumorphic-button p-2 text-red-600 hover:text-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash className="w-4 h-4" />
              </button>
            </Tooltip>
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