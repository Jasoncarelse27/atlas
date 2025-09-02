import { useState } from 'react';
import type { Conversation } from '../../../types/chat';
import { createChatError, getUserFriendlyMessage } from '../lib/errorHandler';
import { useConversations, useCreateConversation, useDeleteConversation, useUpdateConversationTitle } from '../services/conversationService';

interface ReactQueryIntegrationProps {
  userId: string;
}

/**
 * Example component demonstrating React Query integration
 * Shows how to use the new conversation services with proper error handling
 */
export function ReactQueryIntegration({ userId }: ReactQueryIntegrationProps) {
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // React Query hooks
  const { 
    data: conversations, 
    isLoading, 
    error: conversationsError,
    refetch 
  } = useConversations(userId);

  const createConversation = useCreateConversation();
  const updateTitle = useUpdateConversationTitle();
  const deleteConversation = useDeleteConversation();

  // Handle conversation creation
  const handleCreateConversation = async () => {
    if (!newTitle.trim()) return;
    
    try {
      await createConversation.mutateAsync({ 
        userId, 
        title: newTitle.trim() 
      });
      setNewTitle('');
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'createConversation',
        userId,
        timestamp: new Date().toISOString(),
      });
      console.error('Failed to create conversation:', chatError);
      alert(getUserFriendlyMessage(chatError));
    }
  };

  // Handle title editing
  const handleStartEdit = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
  };

  const handleSaveEdit = async (conversationId: string) => {
    if (!editTitle.trim()) return;
    
    try {
      await updateTitle.mutateAsync({
        conversationId,
        userId,
        title: editTitle.trim()
      });
      setEditingId(null);
      setEditTitle('');
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'updateConversationTitle',
        userId,
        conversationId,
        timestamp: new Date().toISOString(),
      });
      console.error('Failed to update title:', chatError);
      alert(getUserFriendlyMessage(chatError));
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  // Handle conversation deletion
  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    
    try {
      await deleteConversation.mutateAsync({ conversationId, userId });
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'deleteConversation',
        userId,
        conversationId,
        timestamp: new Date().toISOString(),
      });
      console.error('Failed to delete conversation:', chatError);
      alert(getUserFriendlyMessage(chatError));
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (conversationsError) {
    const chatError = createChatError(conversationsError, {
      operation: 'getConversations',
      userId,
      timestamp: new Date().toISOString(),
    });
    
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-medium mb-2">Failed to load conversations</h3>
        <p className="text-red-600 text-sm mb-3">{getUserFriendlyMessage(chatError)}</p>
        <button
          onClick={() => refetch()}
          className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Create new conversation */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New conversation title..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && handleCreateConversation()}
        />
        <button
          onClick={handleCreateConversation}
          disabled={createConversation.isPending || !newTitle.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createConversation.isPending ? 'Creating...' : 'Create'}
        </button>
      </div>

      {/* Conversations list */}
      <div className="space-y-2">
        {conversations?.map((conversation) => (
          <div
            key={conversation.id}
            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {editingId === conversation.id ? (
              // Edit mode
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(conversation.id);
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <button
                  onClick={() => handleSaveEdit(conversation.id)}
                  disabled={updateTitle.isPending}
                  className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {updateTitle.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-2 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              // View mode
              <>
                <div className="flex-1">
                  <h3 className="font-medium">{conversation.title}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(conversation.last_updated).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStartEdit(conversation)}
                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteConversation(conversation.id)}
                    disabled={deleteConversation.isPending}
                    className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 disabled:opacity-50"
                  >
                    {deleteConversation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {(!conversations || conversations.length === 0) && (
        <div className="text-center py-8 text-gray-500">
          <p>No conversations yet. Create your first one above!</p>
        </div>
      )}

      {/* Mutation states */}
      {(createConversation.isPending || updateTitle.isPending || deleteConversation.isPending) && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
          {createConversation.isPending && 'Creating conversation...'}
          {updateTitle.isPending && 'Updating title...'}
          {deleteConversation.isPending && 'Deleting conversation...'}
        </div>
      )}
    </div>
  );
}
