import { QueryClient } from '@tanstack/react-query';
import { retryDelaysMs } from '../../../lib/retry';

// Query client configuration optimized for chat app
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry(fails, err: any) {
        const s = err?.status;
        if (s && s < 500) return false;
        return fails < 3;
      },
      retryDelay(i) {
        return retryDelaysMs(3)[i] ?? 8000;
      },
      staleTime: 5 * 60 * 1000,
      
      // Refetch on window focus for real-time updates
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false
    }
  }
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

// React Query DevTools component (import separately in development)
// export { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Export types for use in other files
    export type { QueryClient } from '@tanstack/react-query';

