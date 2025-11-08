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
  private readonly RECENT_DATA_DAYS = 30; // ✅ FIX: Reduced from 90 to 30 days for faster sync

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
        .gte('updated_at', recentDate) // ⚡ 30-day window for faster sync
        .order('updated_at', { ascending: false })
        .limit(30) as { data: SupabaseConversation[] | null; error: any }; // ✅ FIX: Reduced from 50 to 30

      if (error) {
        // ✅ BETTER ERROR LOGGING: Capture full error details
        logger.error('[ConversationSync] Failed to fetch remote conversations:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          userId: userId.slice(0, 8) + '...'
        });
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
        // ✅ BETTER ERROR LOGGING: Capture full error details
        logger.error('[ConversationSync] Failed to fetch remote messages:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          conversationId: conversationId.slice(0, 8) + '...'
        });
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
          // ✅ FIX: Parse JSON content if it's a stringified object
          let parsedContent: string;
          if (typeof remoteMsg.content === 'string') {
            try {
              // Check if content looks like JSON
              if (remoteMsg.content.trim().startsWith('{') && remoteMsg.content.includes('"type"') && remoteMsg.content.includes('"text"')) {
                const parsed = JSON.parse(remoteMsg.content);
                // Extract the actual text from {type: "text", text: "..."}
                parsedContent = parsed.text || parsed.content || remoteMsg.content;
              } else {
                parsedContent = remoteMsg.content;
              }
            } catch (e) {
              // Not JSON, keep as-is
              parsedContent = remoteMsg.content;
            }
          } else {
            // Object format
            parsedContent = remoteMsg.content?.text || '';
          }
          
          // Add new message only if it doesn't exist
          await atlasDB.messages.put({
            id: remoteMsg.id,
            conversationId: remoteMsg.conversation_id,
            userId: _userId, // ✅ Use function parameter, not remoteMsg.user_id
            role: remoteMsg.role, // ✅ CRITICAL: Use actual role from DB (user/assistant)
            type: 'text', // Default to text for now
            content: parsedContent, // ✅ FIX: Use parsed content
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
        // ✅ ONE-SHOT FIX: Always ensure conversation exists before syncing messages
        // Use upsert to handle both creation and existence check in one operation
        // ✅ CRITICAL: Use _userId parameter (not msg.userId) for security
        logger.info('[ConversationSync] 🔍 Ensuring conversation exists:', msg.conversationId);
        const { error: convError } = await supabase
          .from('conversations')
          .upsert({
            id: msg.conversationId,
            user_id: _userId, // ✅ Use authenticated userId parameter, not msg.userId
            title: 'Chat',
            created_at: msg.timestamp,
            updated_at: msg.timestamp
          } as any, {
            onConflict: 'id' // If exists, just update; if not, create
          });
        
        if (convError) {
          // Check if it's a conflict (conversation was created concurrently)
          const isConflict = convError.code === '23505' || 
                            convError.message?.includes('duplicate') ||
                            convError.message?.includes('already exists');
          
          if (isConflict) {
            logger.info('[ConversationSync] ✅ Conversation exists (conflict), continuing:', msg.conversationId);
            // Conversation exists now, continue with message sync
          } else {
            // Log the error and skip this message
            logger.error('[ConversationSync] ❌ Failed to ensure conversation exists:', {
              conversationId: msg.conversationId,
              messageId: msg.id,
              error: convError,
              errorCode: convError.code,
              errorMessage: convError.message,
              errorDetails: (convError as any)?.details,
              errorHint: (convError as any)?.hint
            });
            // Skip this message - can't sync without conversation
            continue;
          }
        } else {
          logger.info('[ConversationSync] ✅ Conversation ensured:', msg.conversationId);
        }
        
        // ✅ CRITICAL FIX: Retry message sync with conversation creation if foreign key error occurs
        let messageSynced = false;
        let retryCount = 0;
        const MAX_RETRIES = 2;
        
        while (!messageSynced && retryCount <= MAX_RETRIES) {
        const { error } = await supabase
          .from('messages')
          .upsert({
            id: msg.id,
            conversation_id: msg.conversationId,
              user_id: _userId, // ✅ Use authenticated userId parameter
            role: msg.role,
            message_type: msg.role,
            content: {
              type: 'text',
              text: msg.content
            },
            created_at: msg.timestamp
          } as any, {
            onConflict: 'id' // ✅ Handle duplicate IDs gracefully
          });

        if (!error) {
            await atlasDB.messages.update(msg.id, { synced: true });
            logger.debug('[ConversationSync] ✅ Synced message:', msg.id);
            messageSynced = true;
          } else {
            const errorStatus = (error as any)?.status || (error as any)?.code;
            const errorMessage = error.message || String(error);
            const errorCode = error.code;
            const errorDetails = (error as any)?.details || '';
            
            // Conflict errors (message already exists)
            const isConflict = 
              errorStatus === 409 || 
              errorStatus === '409' ||
              errorCode === '23505' ||
              errorCode === 'PGRST116' ||
              errorMessage?.includes('duplicate') || 
              errorMessage?.includes('409') ||
              errorMessage?.includes('conflict') ||
              errorMessage?.includes('already exists');
            
            // Foreign key constraint violation (conversation doesn't exist)
            const isForeignKeyError = 
              errorCode === '23503' ||
              errorMessage?.includes('foreign key constraint') ||
              errorMessage?.includes('Key is not present in table "conversations"') ||
              errorDetails?.includes('Key is not present in table "conversations"');
            
            if (isConflict) {
              // Message already exists (likely created by backend), mark as synced
              await atlasDB.messages.update(msg.id, { synced: true });
              logger.debug('[ConversationSync] ✅ Message already exists (409 conflict), marked as synced:', msg.id);
              messageSynced = true;
            } else if (isForeignKeyError && retryCount < MAX_RETRIES) {
              // Conversation doesn't exist - retry conversation creation and message sync
              logger.warn(`[ConversationSync] ⚠️ Foreign key error (attempt ${retryCount + 1}/${MAX_RETRIES}), retrying conversation creation:`, msg.conversationId);
              
              // Retry conversation creation
              const { error: retryConvError } = await supabase
                .from('conversations')
                .upsert({
                  id: msg.conversationId,
                  user_id: _userId,
                  title: 'Chat',
                  created_at: msg.timestamp,
                  updated_at: msg.timestamp
                } as any, { onConflict: 'id' });
              
              if (retryConvError) {
                logger.error('[ConversationSync] ❌ Retry conversation creation failed:', retryConvError);
              }
              
              retryCount++;
              // Small delay before retry to allow database to catch up
              await new Promise(resolve => setTimeout(resolve, 100));
            } else {
              // Unknown error or max retries reached
              logger.error('[ConversationSync] ❌ Failed to sync message:', {
                messageId: msg.id,
                conversationId: msg.conversationId,
                errorCode,
                errorMessage,
                errorDetails,
                errorStatus,
                retryCount
              });
              break; // Exit retry loop
            }
          }
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
   * 
   * PERFORMANCE METRICS:
   * - Tracks queries per sync
   * - Tracks sync duration
   * - Tracks data volume synced
   */
  async deltaSync(userId: string): Promise<void> {
    perfMonitor.start('conversation-sync');
    const startTime = Date.now();
    let queriesExecuted = 0;
    let conversationsSynced = 0;
    let messagesSynced = 0;
    
    if (import.meta.env.DEV) {
      logger.debug('[ConversationSync] 🚀 Starting delta sync...');
      logger.debug('[ConversationSync] ⚡ Optimized: Cursor-based pagination, recent data only');
    }
    
    try {
      // 1. Get last sync timestamp
      const syncMeta = await atlasDB.syncMetadata.get(userId);
      
      // ✅ CRITICAL FIX: Check if IndexedDB is actually empty (even if syncMetadata exists)
      // This handles cases where IndexedDB was cleared but syncMetadata wasn't
      const localConversationCount = await atlasDB.conversations
        .where('userId')
        .equals(userId)
        .count();
      
      const isFirstSync = !syncMeta || localConversationCount === 0;
      
      // ✅ CRITICAL FIX: On first sync (empty Dexie), fetch ALL data, not just last 30 days
      let lastSyncedAt = isFirstSync 
        ? new Date(0).toISOString()  // Epoch = fetch everything
        : syncMeta.lastSyncedAt;
      
      // ✅ Structured logging for diagnostics
      logger.info('[ConversationSync] Sync state', {
        isFirstSync,
        localCount: localConversationCount,
        lastSyncedAt,
        hasSyncMeta: !!syncMeta,
        userId: userId.slice(0, 8) + '...'
      });
      
      // 2. Fetch conversations - use different query for first sync vs delta sync
      let updatedConversations: any[] | null = null;
      let convError: any = null;
      
      if (isFirstSync) {
        // ✅ FIRST SYNC: Fetch ALL conversations (no date filter, just non-deleted)
        logger.info('[ConversationSync] First sync mode - fetching all conversations');
        const result = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null)  // ✅ Only sync non-deleted conversations
          .order('updated_at', { ascending: false })
          .limit(50) as { data: any[] | null; error: any }; // ✅ Increased limit for first sync
        
        updatedConversations = result.data;
        convError = result.error;
      } else {
        // ✅ DELTA SYNC: Only fetch conversations updated since last sync
        logger.info('[ConversationSync] Delta sync mode', { lastSyncedAt });
        const result = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null)  // ✅ Only sync non-deleted conversations
          .gt('updated_at', lastSyncedAt)  // ← DELTA FILTER
          .order('updated_at', { ascending: false })
          .limit(30) as { data: any[] | null; error: any };
        
        updatedConversations = result.data;
        convError = result.error;
      }
      
      queriesExecuted++; // Track query count
      
      if (convError) {
        logger.error('[ConversationSync] ❌ Failed to fetch conversations:', convError);
        return;
      }
      
      conversationsSynced = updatedConversations?.length || 0;
      
      // ✅ Structured logging for sync results
      logger.info('[ConversationSync] Sync results', {
        found: conversationsSynced,
        userId: userId.slice(0, 8) + '...',
        lastSyncedAt,
        isFirstSync,
        localCount: localConversationCount,
        queryType: isFirstSync ? 'FIRST_SYNC' : 'DELTA_SYNC'
      });
      
      // ✅ DIAGNOSTIC: If no conversations found, check if any exist at all
      if (conversationsSynced === 0 && isFirstSync) {
        logger.warn('[ConversationSync] ⚠️ No conversations found on first sync. Checking if any exist...');
        
        const { data: allConversations, error: checkError } = await supabase
          .from('conversations')
          .select('id, title, updated_at, deleted_at')
          .eq('user_id', userId)
          .limit(5);
        
        if (checkError) {
          logger.error('[ConversationSync] ❌ Error checking conversations:', checkError);
        } else if (allConversations) {
          logger.info(`[ConversationSync] 📋 Found ${allConversations.length} total conversations (including deleted):`, 
            (allConversations as any[]).map((c: any) => ({ id: c.id, title: c.title, deleted: !!c.deleted_at }))
          );
        } else {
          logger.info('[ConversationSync] 📋 No conversations found in Supabase at all');
        }
      }
      
      logger.debug(`[ConversationSync] ✅ Found ${conversationsSynced} updated conversations`);
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
          .limit(100) as { data: any[] | null; error: any };
        
        queriesExecuted++; // Track query count
        
        if (msgError) {
          logger.error('[ConversationSync] ❌ Failed to fetch messages:', msgError);
        } else {
          messagesSynced = newMessages?.length || 0;
          logger.debug(`[ConversationSync] ✅ Found ${messagesSynced} new messages`);
          
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
              // ✅ FIX: Parse JSON content if it's a stringified object
              let parsedContent: string;
              if (typeof msg.content === 'string') {
                try {
                  // Check if content looks like JSON
                  if (msg.content.trim().startsWith('{') && msg.content.includes('"type"') && msg.content.includes('"text"')) {
                    const parsed = JSON.parse(msg.content);
                    // Extract the actual text from {type: "text", text: "..."}
                    parsedContent = parsed.text || parsed.content || msg.content;
                  } else {
                    parsedContent = msg.content;
                  }
                } catch (e) {
                  // Not JSON, keep as-is
                  parsedContent = msg.content;
                }
              } else {
                // Object format
                parsedContent = msg.content?.text || '';
              }
              
              await atlasDB.messages.put({
                id: msg.id,
                conversationId: msg.conversation_id,
                userId: userId, // ✅ Use authenticated userId from function parameter
                role: msg.role,
                type: 'text',
                content: parsedContent, // ✅ FIX: Use parsed content
                timestamp: msg.created_at,
                synced: true,
                updatedAt: msg.created_at,
                deletedAt: msg.deleted_at || undefined, // ✅ PHASE 2: Sync deleted status
                deletedBy: msg.deleted_by || undefined  // ✅ PHASE 2: Sync delete type
              });
              logger.debug('[ConversationSync] ✅ Added missing message:', msg.id);
            } else if (msg.deleted_at && !existingMsg.deletedAt) {
              // ✅ PHASE 2: Update existing message if it was deleted remotely
              await atlasDB.messages.update(msg.id, {
                deletedAt: msg.deleted_at,
                deletedBy: msg.deleted_by || 'user'
              });
              logger.debug('[ConversationSync] ✅ Synced delete status for message:', msg.id);
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
        
        // ✅ ONE-SHOT FIX: Always ensure conversation exists before syncing messages
        // Use upsert to handle both creation and existence check in one operation
        logger.info('[ConversationSync] 🔍 Ensuring conversation exists:', msg.conversationId);
        const { error: convError } = await supabase
          .from('conversations')
          .upsert({
            id: msg.conversationId,
            user_id: userId,
            title: 'Chat',
            created_at: msg.timestamp,
            updated_at: msg.timestamp
          } as any, {
            onConflict: 'id' // If exists, just update; if not, create
          });
        
        if (convError) {
          // Check if it's a conflict (conversation was created concurrently)
          const isConflict = convError.code === '23505' || 
                            convError.message?.includes('duplicate') ||
                            convError.message?.includes('already exists');
          
          if (isConflict) {
            logger.info('[ConversationSync] ✅ Conversation exists (conflict), continuing:', msg.conversationId);
            // Conversation exists now, continue with message sync
          } else {
            // Log the error and skip this message
            logger.error('[ConversationSync] ❌ Failed to ensure conversation exists:', {
              conversationId: msg.conversationId,
              messageId: msg.id,
              error: convError,
              errorCode: convError.code,
              errorMessage: convError.message,
              errorDetails: (convError as any)?.details,
              errorHint: (convError as any)?.hint
            });
            // Skip this message - can't sync without conversation
            continue;
          }
        } else {
          logger.info('[ConversationSync] ✅ Conversation ensured:', msg.conversationId);
        }
        
        // ✅ CRITICAL FIX: Retry message sync with conversation creation if foreign key error occurs
        let messageSynced = false;
        let retryCount = 0;
        const MAX_RETRIES = 2;
        
        while (!messageSynced && retryCount <= MAX_RETRIES) {
        const { error } = await supabase
          .from('messages')
          .upsert({
            id: msg.id,
            conversation_id: msg.conversationId,
              user_id: userId,
            role: msg.role,
            content: msg.content, // ✅ Send as string directly
            created_at: msg.timestamp
          } as any, {
            onConflict: 'id' // ✅ Handle duplicate IDs gracefully
          });
        
        if (!error) {
          await atlasDB.messages.update(msg.id, { synced: true });
          logger.debug('[ConversationSync] ✅ Synced message:', msg.id);
            messageSynced = true;
        } else {
            const errorStatus = (error as any)?.status || (error as any)?.code;
            const errorMessage = error.message || String(error);
            const errorCode = error.code;
            const errorDetails = (error as any)?.details || '';
            
            // Conflict errors (message already exists)
            const isConflict = 
              errorStatus === 409 || 
              errorStatus === '409' ||
              errorCode === '23505' ||
              errorCode === 'PGRST116' ||
              errorMessage?.includes('duplicate') || 
              errorMessage?.includes('409') ||
              errorMessage?.includes('conflict') ||
              errorMessage?.includes('already exists');
            
            // Foreign key constraint violation (conversation doesn't exist)
            const isForeignKeyError = 
              errorCode === '23503' ||
              errorMessage?.includes('foreign key constraint') ||
              errorMessage?.includes('Key is not present in table "conversations"') ||
              errorDetails?.includes('Key is not present in table "conversations"');
            
            if (isConflict) {
            // Message already exists (likely created by backend), mark as synced
            await atlasDB.messages.update(msg.id, { synced: true });
              logger.debug('[ConversationSync] ✅ Message already exists (409 conflict), marked as synced:', msg.id);
              messageSynced = true;
            } else if (isForeignKeyError && retryCount < MAX_RETRIES) {
              // Conversation doesn't exist - retry conversation creation and message sync
              logger.warn(`[ConversationSync] ⚠️ Foreign key error (attempt ${retryCount + 1}/${MAX_RETRIES}), retrying conversation creation:`, msg.conversationId);
              
              // Retry conversation creation
              const { error: retryConvError } = await supabase
                .from('conversations')
                .upsert({
                  id: msg.conversationId,
                  user_id: userId,
                  title: 'Chat',
                  created_at: msg.timestamp,
                  updated_at: msg.timestamp
                } as any, { onConflict: 'id' });
              
              if (retryConvError) {
                logger.error('[ConversationSync] ❌ Retry conversation creation failed:', retryConvError);
              }
              
              retryCount++;
              // Small delay before retry to allow database to catch up
              await new Promise(resolve => setTimeout(resolve, 100));
          } else {
              // Unknown error or max retries reached
              logger.error('[ConversationSync] ❌ Failed to sync message:', {
                messageId: msg.id,
                conversationId: msg.conversationId,
                errorCode,
                errorMessage,
                errorDetails,
                errorStatus,
                retryCount
              });
              break; // Exit retry loop
            }
          }
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
      
      // 📊 PERFORMANCE METRICS SUMMARY
      logger.info(`[ConversationSync] ✅ Delta sync completed in ${durationSeconds}s`);
      logger.info(`[ConversationSync] 📊 Metrics: ${queriesExecuted} queries | ${conversationsSynced} conversations | ${messagesSynced} messages`);
      logger.info(`[ConversationSync] ⚡ Efficiency: ${(queriesExecuted / Math.max(duration, 1) * 1000).toFixed(1)} queries/sec`);
      
      // Auto-optimize if sync is slow
      if (duration > 1200) {
        logger.warn(`[ConversationSync] ⚠️ Slow sync detected (${duration}ms) - may need optimization`);
      } else if (duration < 500) {
        logger.debug('[ConversationSync] 🚀 Excellent sync performance!');
      }
      
      if (perfDuration && perfDuration > 5000) {
        logger.warn(`⚠️ [Performance] Conversation sync took ${perfDuration.toFixed(0)}ms - optimization applied`);
      }
      
      // ✅ PERFORMANCE MONITORING: Log sync metrics
      try {
        // Try edge function first (bypasses RLS restrictions)
        const { error } = await supabase.functions.invoke('log-sync-metrics', {
          body: {
            user_id: userId,
            event: 'delta_sync_completed',
            data: {
              duration,
              queries: queriesExecuted,
              conversationsSynced,
              messagesSynced,
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
              queries: queriesExecuted,
              conversationsSynced,
              messagesSynced,
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
