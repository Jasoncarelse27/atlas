import { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Query client configuration optimized for chat app
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Chat messages should be fresh but cached
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      
      // Retry failed requests
      retry: (failureCount: number, error: { status?: number; message?: string }) => {
        // Don't retry on 4xx errors (user errors)
        if (error?.status && error.status >= 400 && error.status < 500) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      
      // Refetch on window focus for real-time updates
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      
      // Optimistic updates for better UX
      optimistic: true,
    },
    
    mutations: {
      // Retry mutations on network errors
      retry: (failureCount: number, error: { status?: number; message?: string }) => {
        if (error?.status && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      
      // Optimistic updates for messages
      onMutate: async (variables) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey: ['messages'] });
        
        // Snapshot previous value
        const previousMessages = queryClient.getQueryData(['messages']);
        
        // Return context with the snapshotted value
        return { previousMessages };
      },
      
      onError: (err, variables, context) => {
        // Rollback on error
        if (context?.previousMessages) {
          queryClient.setQueryData(['messages'], context.previousMessages);
        }
      },
      
      onSettled: () => {
        // Always refetch after error or success
        queryClient.invalidateQueries({ queryKey: ['messages'] });
      },
    },
  },
});

// Query keys factory for consistent key management
export const queryKeys = {
  // Conversation queries
  conversations: {
    all: ['conversations'] as const,
    lists: () => [...queryKeys.conversations.all, 'list'] as const,
    list: (filters: string) => [...queryKeys.conversations.lists(), { filters }] as const,
    details: () => [...queryKeys.conversations.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.conversations.details(), id] as const,
  },
  
  // Message queries
  messages: {
    all: ['messages'] as const,
    lists: () => [...queryKeys.messages.all, 'list'] as const,
    list: (conversationId: string) => [...queryKeys.messages.lists(), conversationId] as const,
    details: () => [...queryKeys.messages.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.messages.details(), id] as const,
  },
  
  // User profile queries
  userProfile: {
    all: ['userProfile'] as const,
    details: () => [...queryKeys.userProfile.all, 'detail'] as const,
    detail: (userId: string) => [...queryKeys.userProfile.details(), userId] as const,
    subscription: (userId: string) => [...queryKeys.userProfile.detail(userId), 'subscription'] as const,
    usage: (userId: string) => [...queryKeys.userProfile.detail(userId), 'usage'] as const,
  },
  
  // AI provider queries
  aiProvider: {
    all: ['aiProvider'] as const,
    config: (tier: string, model?: string) => [...queryKeys.aiProvider.all, 'config', tier, model] as const,
    capabilities: (provider: string) => [...queryKeys.aiProvider.all, 'capabilities', provider] as const,
  },
} as const;

// Mutation keys for consistent mutation management
export const mutationKeys = {
  messages: {
    send: ['messages', 'send'] as const,
    retry: ['messages', 'retry'] as const,
    delete: ['messages', 'delete'] as const,
  },
  conversations: {
    create: ['conversations', 'create'] as const,
    update: ['conversations', 'update'] as const,
    delete: ['conversations', 'delete'] as const,
    pin: ['conversations', 'pin'] as const,
  },
  userProfile: {
    update: ['userProfile', 'update'] as const,
    upgrade: ['userProfile', 'upgrade'] as const,
  },
} as const;

// React Query DevTools component
export { ReactQueryDevtools };

// Export types for use in other files
    export type { QueryClient } from '@tanstack/react-query';

