import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import {
    getUnsyncedConversations,
    getUnsyncedMessages,
    markConversationSynced,
    markMessageSynced,
    useConversations,
    useMessages
} from '../stores/useMessageStore';

export interface UseStorageSyncOptions {
  conversationId?: string;
  userId?: string;
  isSafeMode: boolean;
}

export function useStorageSync(options: UseStorageSyncOptions) {
  const { conversationId, userId, isSafeMode } = options;
  
  // Get messages and conversations from Dexie (with live updates)
  const offlineMessages = useMessages(conversationId || '');
  const offlineConversations = useConversations(userId || '');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Sync offline data to Supabase when online
  const syncOfflineData = async () => {
    if (isSafeMode || !userId) return;
    
    setIsSyncing(true);
    try {
      // Sync unsynced conversations
      const unsyncedConversations = await getUnsyncedConversations();
      for (const conv of unsyncedConversations) {
        try {
          const { data, error } = await supabase
            .from('conversations')
            .insert({
              user_id: conv.user_id,
              title: conv.title,
              created_at: conv.created_at
            })
            .select()
            .single();

          if (!error && data) {
            await markConversationSynced(conv.id, data.id);
          }
        } catch (error) {
          logger.error('Error syncing conversation:', error);
        }
      }

      // Sync unsynced messages
      const unsyncedMessages = await getUnsyncedMessages();
      for (const msg of unsyncedMessages) {
        try {
          const { data, error } = await supabase
            .from('messages')
            .insert({
              conversation_id: msg.conversation_id,
              user_id: msg.user_id,
              role: msg.role,
              content: msg.content,
              created_at: msg.created_at
            })
            .select()
            .single();

          if (!error && data) {
            await markMessageSynced(msg.id, data.id);
          }
        } catch (error) {
          logger.error('Error syncing message:', error);
        }
      }

      setLastSyncTime(new Date());
    } catch (error) {
      logger.error('Error during sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync when coming back online
  useEffect(() => {
    const handleOnline = () => {
      if (!isSafeMode) {
        syncOfflineData();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isSafeMode, userId]);

  // Manual sync function
  const manualSync = () => {
    if (!isSafeMode) {
      syncOfflineData();
    }
  };

  return {
    offlineMessages,
    offlineConversations,
    isSyncing,
    lastSyncTime,
    manualSync,
    syncOfflineData
  };
}
