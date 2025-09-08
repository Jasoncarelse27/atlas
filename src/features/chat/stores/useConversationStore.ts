import { flags } from '@/features/chat/lib/flags';
// V1 keep for fallback
export * as V1 from '@/lib/conversationStore';
import * as V2 from '@/features/chat/stores/conversationStoreV2';

export type { ChatMessage } from '@/types/chat';

// For now, we'll create a simple hook that uses V1 by default
// V2 will be integrated when we have a proper hook interface
export const useConversationStore = () => {
  // This is a placeholder - in a real implementation, this would be a proper hook
  return {
    messages: [],
    isLoading: false,
    error: null,
    sendMessage: async () => {},
    retryMessage: async () => {},
  };
};

export const conversationActions = {
  sendMessage: async () => {},
  retryMessage: async () => {},
  loadMessages: async () => {},
};
