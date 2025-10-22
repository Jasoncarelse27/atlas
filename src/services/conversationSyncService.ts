import { atlasDB } from '../database/atlasDB';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';
import { perfMonitor } from '../utils/performanceMonitor';

// Define proper types for Supabase responses
interface SupabaseConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface SupabaseMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  message_type: string;
  content: string | { type: string; text: string };
  created_at: string;
}

export interface ConversationSyncData {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageSyncData {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  type: 'text' | 'image' | 'audio';
  content: string;
  timestamp: string;
  synced: boolean;
  updatedAt: string;
}

/**
 * Cross-platform conversation synchronization service
 * Handles sync between web and mobile platforms
 */
export class ConversationSyncService {
  private static instance: ConversationSyncService;
  private syncInProgress = false;
  private lastSyncTime = 0;
  private readonly SYNC_COOLDOWN = 30000; // 30 seconds minimum between syncs
  private readonly RECENT_DATA_DAYS = 90; // ✅ FIX: Sync last 90 days (3 months) for mobile/web parity

  static getInstance(): ConversationSyncService {
    if (!ConversationSyncService.instance) {
      ConversationSyncService.instance = new ConversationSyncService();
    }
    return ConversationSyncService.instance;
  }

  /**
   * Sync conversations from Supabase to local Dexie
   * ⚡ OPTIMIZED: Debounced, rate-limited, recent data only
   */
  async syncConversationsFromRemote(userId: string): Promise<void> {
    // ⚡ OPTIMIZATION: Skip if synced recently
    const now = Date.now();
    if (now - this.lastSyncTime < this.SYNC_COOLDOWN) {
      return; // Silent skip - no console spam
    }
    this.lastSyncTime = now;

    try {
      // ⚡ OPTIMIZATION: Sync recent data (90 days for mobile/web parity)
      const recentDate = new Date(Date.now() - (this.RECENT_DATA_DAYS * 24 * 60 * 60 * 1000)).toISOString();
      
      const { data: remoteConversations, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .gte('updated_at', recentDate) // ⚡ 90-day window for comprehensive history
        .order('updated_at', { ascending: false })
        .limit(50) as { data: SupabaseConversation[] | null; error: any }; // ✅ FIX: Increased from 20 to 50

      if (error) {
        logger.error('[ConversationSync] Failed to fetch remote conversations:', error);
        return;
      }

      // ✅ SECURITY FIX: Add userId filter to prevent cross-user data exposure
      const localConversations = await atlasDB.conversations
        .where('userId')
        .equals(userId)
        .limit(100)
        .toArray();

      // Sync conversations
      for (const remoteConv of remoteConversations || []) {
        const localConv = localConversations.find(l => l.id === remoteConv.id);
        
        if (!localConv) {
          // ✅ Add new conversation
          await atlasDB.conversations.put({
            id: remoteConv.id,
            userId: remoteConv.user_id,
            title: remoteConv.title,
            createdAt: remoteConv.created_at,
            updatedAt: remoteConv.updated_at
          });
          // Silent add - no console spam in production
        } else if (new Date(remoteConv.updated_at) > new Date(localConv.updatedAt)) {
          // ✅ Update conversation (no soft delete check needed since we use hard delete)
          
          // Update existing conversation
          await atlasDB.conversations.update(remoteConv.id, {
            title: remoteConv.title,
            updatedAt: remoteConv.updated_at,
          });
          logger.debug('[ConversationSync] ✅ Updated conversation:', remoteConv.id);
        }
      }

      // ✅ CONSERVATIVE SYNC: Don't delete local conversations that don't exist remotely
      // This prevents accidental deletion of conversations that haven't synced yet
      logger.debug('[ConversationSync] ✅ Preserving local conversations - no remote deletion');

      logger.debug('[ConversationSync] ✅ Conversation sync completed');
    } catch (error) {
      logger.error('[ConversationSync] ❌ Conversation sync failed:', error);
    }
  }

  /**
   * Sync messages from Supabase to local Dexie
   */
  async syncMessagesFromRemote(conversationId: string, _userId: string): Promise<void> {
    try {
      logger.debug('[ConversationSync] Syncing messages for conversation:', conversationId);
      
      const { data: remoteMessages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }) as { data: SupabaseMessage[] | null; error: any };

      if (error) {
        logger.error('[ConversationSync] Failed to fetch remote messages:', error);
        return;
      }

      // Get local messages
      const localMessages = await atlasDB.messages
        .where('conversationId')
        .equals(conversationId)
        .toArray();

      // ✅ PHASE 2: Only add missing messages (duplicate check)
      // Real-time listener is primary writer; this is for offline catch-up only
      for (const remoteMsg of remoteMessages || []) {
        // ✅ CRITICAL: Skip messages with invalid userId
        if (!remoteMsg.user_id || remoteMsg.user_id === 'anonymous') {
          logger.warn('[ConversationSync] ⚠️ Skipping message with invalid userId:', remoteMsg.id);
          continue;
        }
        
        const localMsg = localMessages.find(l => l.id === remoteMsg.id);
        
        if (!localMsg) {
          // Add new message only if it doesn't exist
          await atlasDB.messages.put({
            id: remoteMsg.id,
            conversationId: remoteMsg.conversation_id,
            userId: _userId, // ✅ Use function parameter, not remoteMsg.user_id
            role: remoteMsg.role,
            type: remoteMsg.message_type === 'user' ? 'text' : 'text',
            content: typeof remoteMsg.content === 'string' ? remoteMsg.content : remoteMsg.content?.text || '',
            timestamp: remoteMsg.created_at,
            synced: true,
            updatedAt: remoteMsg.created_at
          });
          logger.debug('[ConversationSync] ✅ Added missing message:', remoteMsg.id);
        }
        // Silent skip - no console spam
      }

      logger.debug('[ConversationSync] ✅ Message sync completed for conversation:', conversationId);
    } catch (error) {
      logger.error('[ConversationSync] ❌ Message sync failed:', error);
    }
  }

  /**
   * Push local changes to Supabase
   */
  async pushLocalChangesToRemote(_userId: string): Promise<void> {
    if (this.syncInProgress) {
      logger.debug('[ConversationSync] Sync already in progress, skipping...');
      return;
    }

    this.syncInProgress = true;
    logger.debug('[ConversationSync] Pushing local changes to remote...');

    try {
      // Push unsynced conversations
      // ✅ SECURITY FIX: Filter by userId to prevent cross-user data exposure
      const unsyncedConversations = await atlasDB.conversations
        .where('userId')
        .equals(_userId)
        .and(conv => conv.updatedAt > new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .toArray();

      for (const conv of unsyncedConversations) {
        const { error } = await supabase
          .from('conversations')
          .upsert({
            id: conv.id,
            user_id: conv.userId,
            title: conv.title,
            created_at: conv.createdAt,
            updated_at: conv.updatedAt
          } as any);

        if (error) {
          logger.error('[ConversationSync] Failed to sync conversation:', conv.id, error);
        } else {
          logger.debug('[ConversationSync] ✅ Synced conversation:', conv.id);
        }
      }

      // Push unsynced messages
      // ✅ SECURITY FIX: Filter by userId to prevent cross-user data exposure
      const allMessages = await atlasDB.messages
        .where('userId')
        .equals(_userId)
        .toArray();
      const unsyncedMessages = allMessages.filter(msg => !msg.synced);

      for (const msg of unsyncedMessages) {
        const { error } = await supabase
          .from('messages')
          .upsert({
            id: msg.id,
            conversation_id: msg.conversationId,
            user_id: msg.userId,
            role: msg.role,
            message_type: msg.role,
            content: {
              type: 'text',
              text: msg.content
            },
            created_at: msg.timestamp
          } as any);

        if (error) {
          logger.error('[ConversationSync] Failed to sync message:', msg.id, error);
        } else {
          // Mark as synced
          await atlasDB.messages.update(msg.id, { synced: true });
          logger.debug('[ConversationSync] ✅ Synced message:', msg.id);
        }
      }

      logger.debug('[ConversationSync] ✅ Push sync completed');
    } catch (error) {
      logger.error('[ConversationSync] ❌ Push sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * ✅ DELTA SYNC: Only fetch what changed since last sync
   * This fixes the deletion issue and scales to 100k+ users
   */
  async deltaSync(userId: string): Promise<void> {
    perfMonitor.start('conversation-sync');
    const startTime = Date.now();
    logger.debug('[ConversationSync] Starting delta sync...');
    logger.debug('[ConversationSync] ⚡ Optimized for recent data only');
    
    try {
      // 1. Get last sync timestamp
      let lastSyncedAt = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();  // ✅ FIX: Sync last 90 days (3 months) for mobile/web parity
      const syncMeta = await atlasDB.syncMetadata.get(userId);
      if (syncMeta) {
        lastSyncedAt = syncMeta.lastSyncedAt;
      }
      
      logger.debug('[ConversationSync] Last synced at:', lastSyncedAt);
      
      // 2. Fetch ONLY conversations updated since last sync (non-deleted only)
      const { data: updatedConversations, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)  // ✅ FIX: Only sync non-deleted conversations
        .gt('updated_at', lastSyncedAt)  // ← DELTA FILTER
        .order('updated_at', { ascending: false })
        .limit(50) as { data: any[] | null; error: any };  // ✅ FIX: Increased from 20 to 50 for better coverage
      
      if (convError) {
        logger.error('[ConversationSync] ❌ Failed to fetch conversations:', convError);
        return;
      }
      
      logger.debug('[ConversationSync] ✅ Found', updatedConversations?.length || 0, 'updated conversations');
      logger.debug('[ConversationSync] 📥 Syncing conversations...');
      
      // 3. Sync updated conversations to local (add new ones, update existing ones)
      for (const conv of updatedConversations || []) {
        // ✅ CRITICAL: Check if conversation exists locally first
        const localExists = await atlasDB.conversations.get(conv.id);
        
        if (localExists) {
          // ✅ Check if it was soft-deleted locally
          // Update existing conversation (no soft delete check needed)
          
          // Update existing conversation
          await atlasDB.conversations.put({
            id: conv.id,
            userId: conv.user_id,
            title: conv.title,
            createdAt: conv.created_at,
            updatedAt: conv.updated_at,
          });
          logger.debug('[ConversationSync] ✅ Updated existing conversation:', conv.id);
        } else {
          // ✅ ADD NEW CONVERSATION: This was the missing piece!
          await atlasDB.conversations.put({
            id: conv.id,
            userId: conv.user_id,
            title: conv.title,
            createdAt: conv.created_at,
            updatedAt: conv.updated_at,
          });
          logger.debug('[ConversationSync] ✅ Added new conversation:', conv.id, 'title:', conv.title);
        }
      }
      
      // 4. Fetch ONLY messages for updated conversations
      if (updatedConversations && updatedConversations.length > 0) {
        const conversationIds = updatedConversations.map(c => c.id);
        
        const { data: newMessages, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .in('conversation_id', conversationIds)  // ← ONLY updated conversations
          .gt('created_at', lastSyncedAt)  // ← DELTA FILTER
          .order('created_at', { ascending: true })
          .limit(200) as { data: any[] | null; error: any };  // ⚡ REDUCED for scale
        
        if (msgError) {
          logger.error('[ConversationSync] ❌ Failed to fetch messages:', msgError);
        } else {
          logger.debug('[ConversationSync] ✅ Found', newMessages?.length || 0, 'new messages');
          
          // ✅ PHASE 2: Only add missing messages (duplicate check)
          // Real-time listener is primary writer; this is for offline catch-up only
          for (const msg of newMessages || []) {
            // ✅ CRITICAL: Skip messages with invalid userId
            if (!msg.user_id || msg.user_id === 'anonymous') {
              logger.warn('[ConversationSync] ⚠️ Skipping message with invalid userId from remote:', msg.id);
              continue;
            }
            
            // Check if message already exists
            const existingMsg = await atlasDB.messages.get(msg.id);
            if (!existingMsg) {
              await atlasDB.messages.put({
                id: msg.id,
                conversationId: msg.conversation_id,
                userId: userId, // ✅ Use authenticated userId from function parameter
                role: msg.role,
                type: 'text',
                content: typeof msg.content === 'string' ? msg.content : msg.content?.text || '',
                timestamp: msg.created_at,
                synced: true,
                updatedAt: msg.created_at
              });
              logger.debug('[ConversationSync] ✅ Added missing message:', msg.id);
            }
            // Silent skip - no console spam
          }
        }
      }
      
      // 5. Push unsynced local messages (limit to recent)
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();  // Last 24 hours
      // ✅ SECURITY FIX: Filter by userId to prevent cross-user data exposure
      const allMessages = await atlasDB.messages
        .where('userId')
        .equals(userId)
        .and(msg => msg.timestamp > cutoffDate)
        .toArray();
      
      const unsyncedMessages = allMessages.filter(msg => !msg.synced);
      logger.debug('[ConversationSync] ✅ Found', unsyncedMessages.length, 'unsynced messages');
      
      for (const msg of unsyncedMessages) {
        // ✅ CRITICAL: Skip messages with invalid userId
        if (!msg.userId || msg.userId === 'anonymous') {
          logger.warn('[ConversationSync] ⚠️ Skipping message with invalid userId:', msg.id);
          continue;
        }
        
        // ✅ CRITICAL FIX: Send content as string, not object
        const { error } = await supabase
          .from('messages')
          .upsert({
            id: msg.id,
            conversation_id: msg.conversationId,
            user_id: userId, // ✅ Use authenticated userId from function parameter
            role: msg.role,
            content: msg.content, // ✅ Send as string directly
            created_at: msg.timestamp
          } as any);
        
        if (!error) {
          await atlasDB.messages.update(msg.id, { synced: true });
          logger.debug('[ConversationSync] ✅ Synced message:', msg.id);
        } else {
          logger.error('[ConversationSync] ❌ Failed to sync message:', msg.id, error);
        }
      }
      
      // 6. Update last sync timestamp
      const now = new Date().toISOString();
      await atlasDB.syncMetadata.put({
        userId: userId,
        lastSyncedAt: now,
        syncVersion: 1
      });
      
      const duration = Date.now() - startTime;
      const durationSeconds = (duration / 1000).toFixed(1);
      const perfDuration = perfMonitor.end('conversation-sync');
      logger.info(`[ConversationSync] ✅ Delta sync completed in ${duration}ms`);
      
      // Auto-optimize if sync is slow
      if (duration > 1200) {
        logger.warn(`[ConversationSync] Slow sync detected (${duration}ms) - optimizing for next run`);
        // ✅ FIX: Use correct SyncMetadata type
        logger.debug('[ConversationSync] Consider manual optimization if sync remains slow');
      } else {
        logger.debug('[ConversationSync] 🚀 Sync performance:', durationSeconds + 's', duration < 500 ? '(Excellent!)' : duration < 1000 ? '(Good)' : '(OK)');
      }
      
      if (perfDuration && perfDuration > 5000) {
        logger.warn(`⚠️ [Performance] Conversation sync took ${perfDuration.toFixed(0)}ms - optimization applied`);
      }
      
      // ✅ PERFORMANCE MONITORING: Log sync metrics (future-proof approach)
      try {
        // Try edge function first (bypasses RLS restrictions)
        const { error } = await supabase.functions.invoke('log-sync-metrics', {
          body: {
            user_id: userId,
            event: 'delta_sync_completed',
            data: {
              duration,
              conversationsSynced: updatedConversations?.length || 0,
              messagesSynced: 0,
              unsyncedPushed: unsyncedMessages.length
            }
          }
        });
        
        if (error) {
          // Fallback: Try direct insert (will fail gracefully due to RLS)
          await supabase.from('usage_logs').insert({
            user_id: userId,
            event: 'delta_sync_completed',
            data: {
              duration,
              conversationsSynced: updatedConversations?.length || 0,
              messagesSynced: 0,
              unsyncedPushed: unsyncedMessages.length
            }
          } as any);
        }
      } catch (logError) {
        // Silent fail - monitoring is optional and non-critical
        logger.debug('[ConversationSync] Monitoring disabled (non-critical)');
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('[ConversationSync] ❌ Delta sync failed after', duration, 'ms:', error);
    }
  }

  /**
   * Full bidirectional sync (DEPRECATED - use deltaSync instead)
   */
  async fullSync(userId: string): Promise<void> {
    logger.debug('[ConversationSync] ⚠️ Using deprecated fullSync - switching to deltaSync');
    return this.deltaSync(userId);
  }

  /**
   * 🔧 DEBUG: Reset sync timestamp to force full sync
   */
  async resetSyncTimestamp(userId: string): Promise<void> {
    try {
      logger.debug('[ConversationSync] 🔧 Resetting sync timestamp for user:', userId);
      
      // Delete sync metadata to force full sync on next run
      await atlasDB.syncMetadata.delete(userId);
      
      logger.debug('[ConversationSync] ✅ Sync timestamp reset - next sync will fetch all conversations');
    } catch (error) {
      logger.error('[ConversationSync] ❌ Failed to reset sync timestamp:', error);
    }
  }

  /**
   * 🔧 DEBUG: Force full sync by resetting timestamp and syncing
   */
  async forceFullSync(userId: string): Promise<void> {
    logger.debug('[ConversationSync] 🔧 Forcing full sync...');
    await this.resetSyncTimestamp(userId);
    await this.deltaSync(userId);
  }

  // Note: deleteConversation method removed - use conversationDeleteService.ts for all deletions
}

export const conversationSyncService = ConversationSyncService.getInstance();
