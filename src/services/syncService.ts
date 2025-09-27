import { supabase } from '../lib/supabaseClient';
import { offlineMessageStore } from './offlineMessageStore';
import { useMessageStore } from '../stores/useMessageStore';
import type { Message } from '../types/chat';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingCount: number;
  failedCount: number;
}

class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isOnline = navigator.onLine;
  private syncInProgress = false;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[SYNC] Back online, starting sync...');
      this.startPeriodicSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[SYNC] Gone offline, stopping sync...');
      this.stopPeriodicSync();
    });

    // Start sync if already online
    if (this.isOnline) {
      this.startPeriodicSync();
    }
  }

  /**
   * Start periodic sync every 30 seconds when online
   */
  startPeriodicSync() {
    if (this.syncInterval) return;
    
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncPendingMessages();
      }
    }, 30000); // 30 seconds

    // Also sync immediately
    this.syncPendingMessages();
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const pendingMessages = await offlineMessageStore.getPendingMessages();
    const failedMessages = await offlineMessageStore.getFailedMessages();
    
    return {
      isOnline: this.isOnline,
      isSyncing: this.syncInProgress,
      lastSyncTime: localStorage.getItem('lastSyncTime'),
      pendingCount: pendingMessages.length,
      failedCount: failedMessages.length,
    };
  }

  /**
   * Sync all pending messages to Supabase
   */
  async syncPendingMessages(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) return;

    this.syncInProgress = true;
    console.log('[SYNC] Starting sync of pending messages...');

    try {
      const pendingMessages = await offlineMessageStore.getPendingMessages();
      const failedMessages = await offlineMessageStore.getFailedMessages();
      const allMessages = [...pendingMessages, ...failedMessages];

      if (allMessages.length === 0) {
        console.log('[SYNC] No messages to sync');
        return;
      }

      console.log(`[SYNC] Syncing ${allMessages.length} messages...`);

      for (const message of allMessages) {
        try {
          await this.syncSingleMessage(message);
        } catch (error) {
          console.error(`[SYNC] Failed to sync message ${message.id}:`, error);
          await offlineMessageStore.markAsSyncFailed(message.id, error.message);
        }
      }

      // Update last sync time
      localStorage.setItem('lastSyncTime', new Date().toISOString());
      console.log('[SYNC] ✅ Sync completed successfully');

    } catch (error) {
      console.error('[SYNC] Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync a single message to Supabase
   */
  private async syncSingleMessage(message: any): Promise<void> {
    console.log(`[SYNC] Syncing message ${message.id}...`);

    // Prepare message data for Supabase
    const messageData = {
      id: message.id,
      conversation_id: message.conversation_id,
      user_id: message.user_id,
      role: message.role,
      message_type: message.type || 'text',
      content: message.content,
      metadata: message.metadata || {},
      created_at: message.timestamp,
      updated_at: new Date().toISOString(),
    };

    // Insert or update in Supabase
    const { error } = await supabase
      .from('messages')
      .upsert(messageData, { onConflict: 'id' });

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    // Mark as synced in offline store
    await offlineMessageStore.markAsSynced(message.id);
    console.log(`[SYNC] ✅ Message ${message.id} synced successfully`);
  }

  /**
   * Force sync all messages (for manual trigger)
   */
  async forceSyncAll(): Promise<void> {
    console.log('[SYNC] Force syncing all messages...');
    await this.syncPendingMessages();
  }

  /**
   * Retry failed messages
   */
  async retryFailedMessages(): Promise<void> {
    console.log('[SYNC] Retrying failed messages...');
    const failedMessages = await offlineMessageStore.getFailedMessages();
    
    for (const message of failedMessages) {
      await offlineMessageStore.markAsRetried(message.id);
    }
    
    await this.syncPendingMessages();
  }

  /**
   * Pull latest messages from Supabase and update local store
   */
  async pullLatestMessages(conversationId: string): Promise<void> {
    if (!this.isOnline) return;

    try {
      console.log(`[SYNC] Pulling latest messages for conversation ${conversationId}...`);
      
      const { data: supabaseMessages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch messages: ${error.message}`);
      }

      if (!supabaseMessages || supabaseMessages.length === 0) {
        console.log('[SYNC] No messages found in Supabase');
        return;
      }

      // Convert Supabase messages to local format and save
      for (const msg of supabaseMessages) {
        const localMessage = {
          id: msg.id,
          conversation_id: msg.conversation_id,
          user_id: msg.user_id,
          role: msg.role,
          type: msg.message_type || 'text',
          content: msg.content,
          attachments: msg.metadata?.attachments,
          timestamp: msg.created_at,
          status: 'sent',
          sync_status: 'synced' as const,
          retry_count: 0,
          metadata: msg.metadata || {},
        };

        await offlineMessageStore.saveMessage(localMessage);
      }

      // Update the Zustand store with latest messages
      const messageStore = useMessageStore.getState();
      if (messageStore.conversationId === conversationId) {
        await messageStore.hydrateFromOffline(conversationId);
      }

      console.log(`[SYNC] ✅ Pulled ${supabaseMessages.length} messages from Supabase`);

    } catch (error) {
      console.error('[SYNC] Failed to pull latest messages:', error);
    }
  }

  /**
   * Cleanup old synced messages (keep last 1000 per conversation)
   */
  async cleanupOldMessages(): Promise<void> {
    try {
      console.log('[SYNC] Cleaning up old messages...');
      
      // This would need to be implemented based on your cleanup strategy
      // For now, we'll keep all messages
      console.log('[SYNC] Cleanup completed (no cleanup implemented yet)');
      
    } catch (error) {
      console.error('[SYNC] Cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const syncService = new SyncService();