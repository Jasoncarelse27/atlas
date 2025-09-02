import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import type { Message } from '../../../types/chat';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { offlineMessageStore } from '../../services/offlineMessageStore';
import { pendingQueueManager } from '../../utils/pendingQueue';
import { mutationKeys, queryKeys } from '../lib/queryClient';
import { messageService } from '../services/messageService';

// Extended message types for media support
export interface MediaMessage extends Message {
  messageType: 'voice' | 'image' | 'text';
  metadata?: {
    // Voice metadata
    audioUrl?: string;
    duration?: number;
    transcript?: string;
    // Image metadata
    imageUrl?: string;
    dimensions?: { width: number; height: number };
    filename?: string;
    size?: number;
  };
}

export interface SendMediaMessageRequest {
  content: string;
  messageType: 'voice' | 'image' | 'text';
  metadata?: any;
  conversationId: string;
  userId: string;
}

/**
 * Hook for managing messages with offline support and media handling
 */
export function useMessages(conversationId: string, userId: string) {
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const [isHydrating, setIsHydrating] = useState(true);

  // Merge offline and network messages
  const mergeMessages = useCallback((offline: any[], network: any[]) => {
    const merged = [...offline];
    
    network.forEach(networkMsg => {
      const existingIndex = merged.findIndex(msg => msg.id === networkMsg.id);
      if (existingIndex >= 0) {
        // Update existing offline message with network data
        merged[existingIndex] = { ...merged[existingIndex], ...networkMsg, sync_status: 'synced' };
      } else {
        // Add new network message
        merged.push({ ...networkMsg, sync_status: 'synced' });
      }
    });

    // Sort by timestamp
    return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, []);

  // Fetch messages with offline-first approach
  const { data: messages = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.messages.list(conversationId),
    queryFn: async () => {
      // First, get messages from offline store
      const offlineMessages = await offlineMessageStore.getMessagesByConversation(conversationId);
      
      if (isOnline) {
        try {
          // Then fetch from network
          const networkMessages = await messageService.getMessages(conversationId);
          
          // Merge and update offline store
          const merged = mergeMessages(offlineMessages, networkMessages);
          await Promise.all(
            merged.map(msg => offlineMessageStore.saveMessage(msg))
          );
          
          return merged;
        } catch (error) {
          // If network fails, return offline messages
          console.warn('Network fetch failed, using offline messages:', error);
          return offlineMessages;
        }
      }
      
      return offlineMessages;
    },
    enabled: !!conversationId && !!userId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
  });

  // Initial hydration from offline store
  useEffect(() => {
    const hydrateFromOffline = async () => {
      try {
        const offlineMessages = await offlineMessageStore.getMessagesByConversation(conversationId);
        if (offlineMessages.length > 0) {
          queryClient.setQueryData(queryKeys.messages.list(conversationId), offlineMessages);
        }
      } catch (error) {
        console.warn('Failed to hydrate from offline store:', error);
      } finally {
        setIsHydrating(false);
      }
    };

    if (conversationId && userId) {
      hydrateFromOffline();
    }
  }, [conversationId, userId, queryClient]);

  // Send message with media support
  const sendMessage = useMutation({
    mutationKey: mutationKeys.messages.send,
    mutationFn: async (request: SendMediaMessageRequest) => {
      // Save to offline store first
      const offlineMessage: MediaMessage = {
        id: `offline_${Date.now()}_${Math.random()}`,
        conversation_id: request.conversationId,
        user_id: request.userId,
        role: 'user',
        content: request.content,
        messageType: request.messageType,
        metadata: request.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_error: null,
        retry_count: 0,
      };

      await offlineMessageStore.saveMessage(offlineMessage);

      // If offline, add to pending queue
      if (!isOnline) {
        await pendingQueueManager.addToQueue('send_message', {
          message: offlineMessage,
          request,
        }, 1);
        return offlineMessage;
      }

      // If online, try to send via service
      try {
        const response = await messageService.sendMessage({
          content: request.content,
          conversationId: request.conversationId,
          userId: request.userId,
          messageType: request.messageType,
          metadata: request.metadata,
        });

        // Mark as synced in offline store
        await offlineMessageStore.markAsSynced(offlineMessage.id);
        
        return response;
      } catch (error) {
        // Mark as failed and add to pending queue
        await offlineMessageStore.markAsSyncFailed(offlineMessage.id, error instanceof Error ? error.message : 'Unknown error');
        await pendingQueueManager.addToQueue('send_message', {
          message: offlineMessage,
          request,
        }, 1);
        throw error;
      }
    },
    onMutate: async (request) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.messages.list(conversationId) });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData(queryKeys.messages.list(conversationId));

      // Optimistically add message
      const optimisticMessage: MediaMessage = {
        id: `optimistic_${Date.now()}`,
        conversation_id: request.conversationId,
        user_id: request.userId,
        role: 'user',
        content: request.content,
        messageType: request.messageType,
        metadata: request.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_error: null,
        retry_count: 0,
      };

      queryClient.setQueryData(queryKeys.messages.list(conversationId), (old: any) => [
        ...(old || []),
        optimisticMessage,
      ]);

      return { previousMessages, optimisticMessage };
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.list(conversationId) });
    },
    onError: (error, variables, context) => {
      // Revert optimistic update
      if (context?.previousMessages) {
        queryClient.setQueryData(queryKeys.messages.list(conversationId), context.previousMessages);
      }
    },
    onSettled: () => {
      // Always refetch after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.list(conversationId) });
    },
  });

  // Send streaming message (requires online)
  const sendStreamingMessage = useMutation({
    mutationKey: [...mutationKeys.messages.send, 'streaming'],
    mutationFn: async ({ request, onChunk }: { request: SendMediaMessageRequest; onChunk: (chunk: string) => void }) => {
      if (!isOnline) {
        throw new Error('Streaming requires an internet connection');
      }

      return await messageService.sendMessageStream({
        content: request.content,
        conversationId: request.conversationId,
        userId: request.userId,
        messageType: request.messageType,
        metadata: request.metadata,
      }, onChunk);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.list(conversationId) });
    },
  });

  // Delete message
  const deleteMessage = useMutation({
    mutationKey: mutationKeys.messages.delete,
    mutationFn: async ({ messageId }: { messageId: string }) => {
      // Delete from offline store first
      await offlineMessageStore.deleteMessage(messageId);

      if (isOnline) {
        try {
          await messageService.deleteMessage(messageId, conversationId);
          return { success: true };
        } catch (error) {
          // Add to pending queue for retry
          await pendingQueueManager.addToQueue('delete_message', {
            messageId,
            conversationId,
          }, 2);
          throw error;
        }
      } else {
        // Add to pending queue for when online
        await pendingQueueManager.addToQueue('delete_message', {
          messageId,
          conversationId,
        }, 2);
        return { success: true };
      }
    },
    onMutate: async ({ messageId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.messages.list(conversationId) });
      const previousMessages = queryClient.getQueryData(queryKeys.messages.list(conversationId));

      queryClient.setQueryData(queryKeys.messages.list(conversationId), (old: any) =>
        old?.filter((msg: any) => msg.id !== messageId) || []
      );

      return { previousMessages };
    },
    onError: (error, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(queryKeys.messages.list(conversationId), context.previousMessages);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.list(conversationId) });
    },
  });

  // Retry message
  const retryMessage = useMutation({
    mutationKey: mutationKeys.messages.retry,
    mutationFn: async ({ messageId }: { messageId: string }) => {
      // Mark as retried in offline store
      await offlineMessageStore.markAsRetried(messageId);
      
      // Get the message and retry sending
      const message = await offlineMessageStore.getMessage(messageId);
      if (!message) throw new Error('Message not found');

      return await sendMessage.mutateAsync({
        content: message.content,
        messageType: message.messageType || 'text',
        metadata: message.metadata,
        conversationId: message.conversation_id,
        userId: message.user_id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.list(conversationId) });
    },
  });

  // Get messages since timestamp
  const getMessagesSince = useCallback(async (since: number) => {
    if (isOnline) {
      try {
        const newMessages = await messageService.getMessagesSince(conversationId, since);
        return newMessages;
      } catch (error) {
        console.warn('Failed to fetch new messages:', error);
        return [];
      }
    }
    return [];
  }, [conversationId, isOnline]);

  // Sync pending messages when online
  useEffect(() => {
    if (isOnline) {
      const syncPendingMessages = async () => {
        try {
          await pendingQueueManager.processQueue();
          refetch();
        } catch (error) {
          console.warn('Failed to sync pending messages:', error);
        }
      };

      syncPendingMessages();
    }
  }, [isOnline, refetch]);

  return {
    // Data
    messages: messages as MediaMessage[],
    
    // Loading states
    isLoading: isLoading || isHydrating,
    isHydrating,
    
    // Network status
    isOnline,
    
    // Mutations
    sendMessage,
    sendStreamingMessage,
    deleteMessage,
    retryMessage,
    
    // Queries
    getMessagesSince,
    
    // Utilities
    refetch,
    error,
  };
}

/**
 * Hook for a single message
 */
export function useMessage(messageId: string, conversationId: string) {
  return useQuery({
    queryKey: queryKeys.messages.detail(messageId),
    queryFn: async () => {
      // Try offline first
      const offlineMessage = await offlineMessageStore.getMessage(messageId);
      if (offlineMessage) return offlineMessage;

      // Fallback to network if online
      if (navigator.onLine) {
        // This would require a getMessage method in messageService
        // For now, return offline message
        return offlineMessage;
      }

      return offlineMessage;
    },
    enabled: !!messageId && !!conversationId,
  });
}
