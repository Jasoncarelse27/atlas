import { useEffect, useState } from 'react';
import { useMessageStore } from '../stores/useMessageStore';
import { syncService } from '../services/syncService';
import { resendService } from '../services/resendService';
import type { Message } from '../types/chat';

export interface UsePersistentMessagesOptions {
  conversationId: string;
  userId: string;
  autoSync?: boolean;
  autoResend?: boolean;
}

export interface UsePersistentMessagesReturn {
  messages: Message[];
  isHydrated: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  addMessage: (message: Message) => Promise<void>;
  updateMessage: (id: string, patch: Partial<Message>) => Promise<void>;
  clearMessages: () => void;
  retryFailedMessage: (messageId: string) => Promise<void>;
  retryAllFailed: () => Promise<void>;
  forceSync: () => Promise<void>;
  refreshMessages: () => Promise<void>;
}

/**
 * Hook for managing persistent messages with offline sync
 */
export function usePersistentMessages({
  conversationId,
  userId,
  autoSync = true,
  autoResend = true,
}: UsePersistentMessagesOptions): UsePersistentMessagesReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const {
    messages,
    isHydrated,
    addMessage: storeAddMessage,
    updateMessage: storeUpdateMessage,
    clearMessages: storeClearMessages,
    setConversationId,
  } = useMessageStore();

  // Set conversation ID when it changes
  useEffect(() => {
    if (conversationId) {
      setConversationId(conversationId);
    }
  }, [conversationId, setConversationId]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update sync status periodically
  useEffect(() => {
    const updateSyncStatus = async () => {
      try {
        const status = await syncService.getSyncStatus();
        setIsSyncing(status.isSyncing);
        setPendingCount(status.pendingCount);
        setFailedCount(status.failedCount);
      } catch (error) {
        console.error('[usePersistentMessages] Failed to get sync status:', error);
      }
    };

    updateSyncStatus();
    const interval = setInterval(updateSyncStatus, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Auto-sync when online
  useEffect(() => {
    if (autoSync && isOnline && conversationId) {
      syncService.pullLatestMessages(conversationId);
    }
  }, [autoSync, isOnline, conversationId]);

  // Auto-resend failed messages when coming online
  useEffect(() => {
    if (autoResend && isOnline) {
      resendService.autoRetryOnConnection();
    }
  }, [autoResend, isOnline]);

  // Enhanced addMessage with user ID
  const addMessage = async (message: Message) => {
    const messageWithUserId = {
      ...message,
      metadata: {
        ...message.metadata,
        userId,
      },
    };
    
    await storeAddMessage(messageWithUserId);
  };

  // Enhanced updateMessage
  const updateMessage = async (id: string, patch: Partial<Message>) => {
    await storeUpdateMessage(id, patch);
  };

  // Clear messages
  const clearMessages = () => {
    storeClearMessages();
  };

  // Retry a specific failed message
  const retryFailedMessage = async (messageId: string) => {
    try {
      const result = await resendService.retryMessage(messageId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to retry message');
      }
    } catch (error) {
      console.error('[usePersistentMessages] Failed to retry message:', error);
      throw error;
    }
  };

  // Retry all failed messages
  const retryAllFailed = async () => {
    try {
      const results = await resendService.resendFailedMessages();
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        throw new Error(`${failed.length} messages failed to resend`);
      }
    } catch (error) {
      console.error('[usePersistentMessages] Failed to retry all messages:', error);
      throw error;
    }
  };

  // Force sync all messages
  const forceSync = async () => {
    try {
      setIsSyncing(true);
      await syncService.forceSyncAll();
    } catch (error) {
      console.error('[usePersistentMessages] Force sync failed:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  // Refresh messages from offline store
  const refreshMessages = async () => {
    try {
      if (conversationId) {
        const { hydrateFromOffline } = useMessageStore.getState();
        await hydrateFromOffline(conversationId);
      }
    } catch (error) {
      console.error('[usePersistentMessages] Failed to refresh messages:', error);
      throw error;
    }
  };

  return {
    messages,
    isHydrated,
    isOnline,
    isSyncing,
    pendingCount,
    failedCount,
    addMessage,
    updateMessage,
    clearMessages,
    retryFailedMessage,
    retryAllFailed,
    forceSync,
    refreshMessages,
  };
}
