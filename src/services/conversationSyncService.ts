import type { PostgrestError } from '@supabase/supabase-js';
import { atlasDB } from '../database/atlasDB';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';
import type { Json } from '../types/database.types';
import { perfMonitor } from '../utils/performanceMonitor';

// Define proper types for Supabase responses
interface SupabaseConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface SupabaseMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  message_type: string;
  content: string;  // Database expects string, not object
  created_at: string;
  deleted_at?: string | null;
  deleted_by?: 'user' | 'everyone' | null;
  attachments?: Json; // ✅ CRITICAL FIX: Add attachments field (JSONB array)
  image_url?: string | null; // ✅ Legacy image support
}

// Type for message insert/update (content can be object during transformation)
interface SupabaseMessageInsert {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  message_type: string;
  content: string;  // Must be string for database
  created_at: string;
}

// Type for Supabase query response
type SupabaseQueryResponse<T> = {
  data: T | null;
  error: PostgrestError | null;
};

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
  private syncDebounceTimer: NodeJS.Timeout | null = null;
  // ✅ PERFORMANCE OPTIMIZATION: Adaptive sync cooldown based on activity
  private readonly SYNC_COOLDOWN_ACTIVE = 60000; // 1 min for active users
  private readonly SYNC_COOLDOWN_IDLE = 180000; // 3 min for idle users
  private readonly SYNC_DEBOUNCE_ACTIVE = 5000; // ✅ OPTIMIZED: 5 second debounce for active users
  private readonly SYNC_DEBOUNCE_IDLE = 8000; // ✅ OPTIMIZED: 8 second debounce for idle users (reduced from 10s)
  private readonly SYNC_DEBOUNCE = 8000; // ✅ DEPRECATED: Use SYNC_DEBOUNCE_ACTIVE/IDLE instead
  private readonly RECENT_DATA_DAYS = 30; // ✅ FIX: Reduced from 90 to 30 days for faster sync
  private readonly JITTER_MAX_MS = 2000; // ✅ PERFORMANCE: Max 2s jitter to prevent sync storms

  static getInstance(): ConversationSyncService {
    if (!ConversationSyncService.instance) {
      ConversationSyncService.instance = new ConversationSyncService();
    }
    return ConversationSyncService.instance;
  }

  /**
   * Sync conversations from Supabase to local Dexie
   * ⚡ OPTIMIZED: Debounced, rate-limited, recent data only
   * @param userId - User ID to sync conversations for
   * @param isActive - Whether user is actively typing/sending messages (uses faster cooldown)
   */
  async syncConversationsFromRemote(userId: string, isActive = false): Promise<void> {
    // ⚡ OPTIMIZATION: Adaptive cooldown based on user activity
    const cooldown = isActive ? this.SYNC_COOLDOWN_ACTIVE : this.SYNC_COOLDOWN_IDLE;
    const now = Date.now();
    if (now - this.lastSyncTime < cooldown) {
      return; // Silent skip - no console spam
    }
    this.lastSyncTime = now;

    try {
      // ⚡ OPTIMIZATION: Sync recent data (90 days for mobile/web parity)
      const recentDate = new Date(Date.now() - (this.RECENT_DATA_DAYS * 24 * 60 * 60 * 1000)).toISOString();
      
      // ✅ NETWORK FIX: Retry logic with exponential backoff for "Load failed" errors
      let remoteConversations: SupabaseConversation[] | null = null;
      let error: PostgrestError | null = null;
      const MAX_RETRIES = 3;
      let attempt = 0;
      
      for (attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const result = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .gte('updated_at', recentDate)
            .order('updated_at', { ascending: false })
            .limit(30) as SupabaseQueryResponse<SupabaseConversation[]>;
          
          remoteConversations = result.data;
          error = result.error;
          
          // Success - break retry loop
          if (!error) {
            break;
          }
          
          // Don't retry non-network errors
          if (error.code && error.code !== 'PGRST116') {
            break;
          }
          
          // Retry with exponential backoff
          if (attempt < MAX_RETRIES - 1) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
            logger.debug(`[ConversationSync] ⚡ Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (fetchError: unknown) {
          // Network error (TypeError: Load failed)
          const err = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
          if (!(fetchError instanceof TypeError) || !err.message?.includes('Load failed')) {
            error = { 
              message: err.message, 
              code: 'NETWORK_ERROR',
              details: err.stack || undefined,
              hint: undefined,
              name: 'PostgrestError'
            } as unknown as PostgrestError;
            break;
          }
          
          // Retry network errors
          if (attempt < MAX_RETRIES - 1) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
            logger.debug(`[ConversationSync] ⚡ Network error, retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            error = {
              message: err.message,
              code: 'NETWORK_ERROR',
              details: undefined,
              hint: undefined,
              name: 'PostgrestError'
            } as unknown as PostgrestError;
          }
        }
      }

      if (error) {
        // ✅ IMPROVED: Only log errors once (not on every retry)
        if (attempt === MAX_RETRIES - 1 || !error.message?.includes('Load failed')) {
          logger.error('[ConversationSync] ❌ Failed to fetch conversations:', {
            code: error.code || 'NETWORK_ERROR',
            message: error.message,
            details: error.details,
            hint: error.hint,
            userId: userId.slice(0, 8) + '...',
            retries: attempt + 1
          });
        }
        return;
      }

      // ✅ SECURITY FIX: Add userId filter to prevent cross-user data exposure
      const localConversations = await atlasDB.conversations
        .where('userId')
        .equals(userId)
        .limit(20) // ✅ SCALABILITY FIX: Reduced from 100 to 20 for 10k+ users
        .toArray();

      // Sync conversations
      for (const remoteConv of remoteConversations || []) {
        // ✅ CRITICAL: Double-check deleted_at (defense in depth)
        if (remoteConv.deleted_at) {
          // Mark as deleted locally if it exists
          const localConv = localConversations.find(l => l.id === remoteConv.id);
          if (localConv && !localConv.deletedAt) {
            await atlasDB.conversations.update(remoteConv.id, {
              deletedAt: remoteConv.deleted_at
            });
            logger.debug('[ConversationSync] ✅ Marked conversation as deleted locally:', remoteConv.id);
          }
          continue;
        }
        
        const localConv = localConversations.find(l => l.id === remoteConv.id);
        
        if (!localConv) {
          // ✅ Add new conversation (only if not deleted)
          await atlasDB.conversations.put({
            id: remoteConv.id,
            userId: remoteConv.user_id,
            title: remoteConv.title,
            createdAt: remoteConv.created_at,
            updatedAt: remoteConv.updated_at,
            deletedAt: undefined // Ensure it's not marked as deleted
          });
          // Silent add - no console spam in production
        } else if (new Date(remoteConv.updated_at) > new Date(localConv.updatedAt)) {
          // ✅ CRITICAL: If locally deleted but remotely not deleted, restore it
          if (localConv.deletedAt && !remoteConv.deleted_at) {
            logger.debug('[ConversationSync] 🔄 Restoring conversation that was deleted locally but not remotely:', remoteConv.id);
            await atlasDB.conversations.update(remoteConv.id, {
              deletedAt: undefined,
              title: remoteConv.title,
              updatedAt: remoteConv.updated_at,
            });
            logger.debug('[ConversationSync] ✅ Restored conversation:', remoteConv.id);
          } else if (!localConv.deletedAt) {
            // Update existing non-deleted conversation
            await atlasDB.conversations.update(remoteConv.id, {
              title: remoteConv.title,
              updatedAt: remoteConv.updated_at,
            });
            logger.debug('[ConversationSync] ✅ Updated conversation:', remoteConv.id);
          }
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
      
      // ✅ SCALABILITY: Limit sync to last 100 messages to prevent memory overload
      // For full history, users can use "Load Older Messages" in the UI
      const { data: remoteMessages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(100) as SupabaseQueryResponse<SupabaseMessage[]>;

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

      // ✅ SCALABILITY: Only load last 100 local messages (matches remote limit)
      // This prevents loading 10k+ messages when checking for duplicates
      // ✅ FIX: sortBy works on Collection, orderBy doesn't
      let localMessages = await atlasDB.messages
        .where('conversationId')
        .equals(conversationId)
        .sortBy('timestamp');
      
      // Reverse and limit in JS
      localMessages = localMessages.reverse().slice(0, 100);

      // ✅ SCALABILITY: Reverse to process oldest first (normal order)
      const reversedMessages = remoteMessages ? [...remoteMessages].reverse() : [];
      
      // ✅ PHASE 2: Only add missing messages (duplicate check)
      // Real-time listener is primary writer; this is for offline catch-up only
      for (const remoteMsg of reversedMessages) {
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
            // Object format (shouldn't happen with SupabaseMessage type, but handle safely)
            parsedContent = typeof remoteMsg.content === 'object' && remoteMsg.content !== null && 'text' in remoteMsg.content
              ? String((remoteMsg.content as { text?: string }).text || '')
              : String(remoteMsg.content || '');
          }
          
          // ✅ CRITICAL FIX: Parse attachments from JSONB field
          let parsedAttachments: Array<{ type: string; url: string; name?: string }> | undefined;
          if (remoteMsg.attachments) {
            try {
              // Handle both string and object formats
              const attachmentsData = typeof remoteMsg.attachments === 'string' 
                ? JSON.parse(remoteMsg.attachments)
                : remoteMsg.attachments;
              
              if (Array.isArray(attachmentsData) && attachmentsData.length > 0) {
                parsedAttachments = attachmentsData.map((att: any) => ({
                  type: att.type || 'file',
                  url: att.url || att.publicUrl || '',
                  name: att.name || att.fileName
                }));
              }
            } catch (e) {
              logger.warn('[ConversationSync] Failed to parse attachments:', e);
            }
          }
          
          // ✅ CRITICAL FIX: Determine message type from attachments or message_type
          let messageType: 'text' | 'image' | 'audio' = 'text';
          if (parsedAttachments && parsedAttachments.length > 0) {
            // Check first attachment type to determine message type
            const firstAttachmentType = parsedAttachments[0].type;
            if (firstAttachmentType === 'audio') {
              messageType = 'audio';
            } else if (firstAttachmentType === 'image') {
              messageType = 'image';
            }
          } else if (remoteMsg.message_type) {
            // Fallback to message_type field
            const msgType = remoteMsg.message_type.toLowerCase();
            if (msgType === 'audio' || msgType === 'voice') {
              messageType = 'audio';
            } else if (msgType === 'image' || msgType === 'photo') {
              messageType = 'image';
            }
          } else if (remoteMsg.image_url) {
            // Legacy image support
            messageType = 'image';
            if (!parsedAttachments) {
              parsedAttachments = [{ type: 'image', url: remoteMsg.image_url }];
            }
          }
          
          // Add new message only if it doesn't exist
          await atlasDB.messages.put({
            id: remoteMsg.id,
            conversationId: remoteMsg.conversation_id,
            userId: _userId, // ✅ Use function parameter, not remoteMsg.user_id
            role: remoteMsg.role, // ✅ CRITICAL: Use actual role from DB (user/assistant)
            type: messageType, // ✅ FIX: Use determined message type (not hardcoded 'text')
            content: parsedContent, // ✅ FIX: Use parsed content
            timestamp: remoteMsg.created_at,
            status: 'sent', // ✅ CRITICAL: Synced messages are already sent
            synced: true,
            updatedAt: remoteMsg.created_at,
            attachments: parsedAttachments, // ✅ CRITICAL FIX: Sync attachments for audio/image messages
            imageUrl: remoteMsg.image_url || undefined // ✅ Legacy image support
          });
          logger.debug('[ConversationSync] ✅ Added missing message:', {
            id: remoteMsg.id,
            type: messageType,
            hasAttachments: !!parsedAttachments?.length
          });
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
          } as SupabaseConversation);

        if (error) {
          logger.error('[ConversationSync] Failed to sync conversation:', conv.id, error);
        } else {
          logger.debug('[ConversationSync] ✅ Synced conversation:', conv.id);
        }
      }

      // ✅ SCALABILITY FIX: Only load unsynced messages from last 24 hours
      // Push unsynced messages (limited to recent for performance)
      // ✅ SECURITY FIX: Filter by userId to prevent cross-user data exposure
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const allMessages = await atlasDB.messages
        .where('userId')
        .equals(_userId)
        .filter(msg => !msg.synced && msg.timestamp >= cutoffDate)
        .toArray();
      const unsyncedMessages = allMessages; // Already filtered to unsynced above

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
          } as SupabaseConversation, {
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
              errorDetails: convError.details,
              errorHint: convError.hint
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
        // ✅ Convert content to string (database expects string, not object)
        const contentString = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        
        const { error } = await supabase
          .from('messages')
          .upsert({
            id: msg.id,
            conversation_id: msg.conversationId,
              user_id: _userId, // ✅ Use authenticated userId parameter
            role: msg.role,
            message_type: msg.role,
            content: contentString, // ✅ Must be string for database
            created_at: msg.timestamp
          } as SupabaseMessageInsert, {
            onConflict: 'id' // ✅ Handle duplicate IDs gracefully
          });

        if (!error) {
            await atlasDB.messages.update(msg.id, { synced: true });
            logger.debug('[ConversationSync] ✅ Synced message:', msg.id);
            messageSynced = true;
          } else {
            const errorStatus = (error as PostgrestError & { status?: number })?.status || error.code;
            const errorMessage = error.message || String(error);
            const errorCode = error.code;
            const errorDetails = error.details || '';
            
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
                } as SupabaseConversation, { onConflict: 'id' });
              
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
   * 
   * ✅ OPTIMIZED: Debounced and rate-limited to prevent rapid-fire syncs
   * @param userId - User ID to sync conversations for
   * @param force - Force sync even if cooldown/debounce is active
   * @param checkForMissing - Check for missing conversations and sync all if mismatch detected
   * @param isActive - Whether user is actively typing/sending messages (uses faster cooldown/debounce)
   */
  async deltaSync(userId: string, force: boolean = false, checkForMissing: boolean = false, isActive = false): Promise<void> {
    // ✅ OPTIMIZATION: Debounce rapid sync requests
    if (!force && this.syncDebounceTimer) {
      logger.debug('[ConversationSync] ⏳ Debouncing sync request...');
      return;
    }
    
    // ✅ PERFORMANCE: Adaptive cooldown based on user activity
    const now = Date.now();
    const timeSinceLastSync = now - this.lastSyncTime;
    const adaptiveCooldown = isActive ? this.SYNC_COOLDOWN_ACTIVE : this.SYNC_COOLDOWN_IDLE;
    
    if (!force && timeSinceLastSync < adaptiveCooldown) {
      logger.debug(`[ConversationSync] ⏳ Sync cooldown active (${Math.round((adaptiveCooldown - timeSinceLastSync) / 1000)}s remaining), skipping...`);
      return;
    }
    
    // ✅ OPTIMIZATION: Prevent concurrent syncs
    if (this.syncInProgress) {
      logger.debug('[ConversationSync] ⏳ Sync already in progress, skipping...');
      return;
    }
    
    // ✅ PERFORMANCE: Adaptive debounce based on user activity
    if (!force) {
      const debounceTime = isActive ? this.SYNC_DEBOUNCE_ACTIVE : this.SYNC_DEBOUNCE_IDLE;
      const jitter = Math.floor(Math.random() * this.JITTER_MAX_MS);
      this.syncDebounceTimer = setTimeout(() => {
        this.syncDebounceTimer = null;
      }, debounceTime + jitter);
      
      // If jitter is significant, delay the actual sync
      if (jitter > 500) {
        await new Promise(resolve => setTimeout(resolve, jitter));
      }
    }
    
    this.syncInProgress = true;
    this.lastSyncTime = now;
    
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
      // ✅ SCALABILITY FIX: Use efficient count instead of loading all conversations
      // Count non-deleted conversations (matches remote count logic)
      const allLocalConversations = await atlasDB.conversations
        .where('userId')
        .equals(userId)
        .filter(conv => !conv.deletedAt)
        .count();
      const localConversationCount = allLocalConversations;
      
      const isFirstSync = !syncMeta || localConversationCount === 0;
      
      // ✅ COMPREHENSIVE SYNC FIX: Detect missing conversations and force full sync
      // This ensures mobile/web parity by comparing counts and syncing all if mismatch detected
      let shouldForceFullSync = isFirstSync;
      
      if (!isFirstSync && checkForMissing) {
        // Fetch remote conversation count to compare with local
        const { count: remoteCount, error: countError } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .is('deleted_at', null);
        
        if (!countError && remoteCount !== null) {
          const countDiff = remoteCount - localConversationCount;
          
          // ✅ CRITICAL FIX: If we're missing ANY conversations, force full sync
          // Changed from countDiff > 1 to countDiff > 0 to catch single missing conversations
          if (countDiff > 0) {
            logger.warn(`[ConversationSync] 🔄 Missing ${countDiff} conversation(s) (local: ${localConversationCount}, remote: ${remoteCount}) - forcing full sync`);
            shouldForceFullSync = true;
            // Clear sync metadata to force first sync
            await atlasDB.syncMetadata.delete(userId);
          } else if (countDiff < 0) {
            // Local has more than remote (shouldn't happen, but log for debugging)
            logger.debug(`[ConversationSync] ⚠️ Local has ${Math.abs(countDiff)} more conversation(s) than remote - this is unusual`);
          }
        }
      }
      
      // ✅ CRITICAL FIX: On first sync (empty Dexie) or when missing conversations, fetch ALL data
      let lastSyncedAt = shouldForceFullSync 
        ? new Date(0).toISOString()  // Epoch = fetch everything
        : (syncMeta?.lastSyncedAt || new Date(0).toISOString());
      
      // ✅ Structured logging for diagnostics
      logger.info('[ConversationSync] Sync state', {
        isFirstSync,
        localCount: localConversationCount,
        lastSyncedAt,
        hasSyncMeta: !!syncMeta,
        userId: userId.slice(0, 8) + '...'
      });
      
      // 2. Fetch conversations - use different query for first sync vs delta sync
      let updatedConversations: SupabaseConversation[] | null = null;
      let convError: PostgrestError | null = null;
      
      if (shouldForceFullSync) {
        // ✅ FULL SYNC: Fetch ALL conversations (no date filter, just non-deleted)
        // ✅ COMPREHENSIVE FIX: Increased limit to 200 to ensure mobile/web parity
        logger.info('[ConversationSync] Full sync mode - fetching all conversations', { 
          reason: isFirstSync ? 'first sync' : 'missing conversations detected' 
        });
        const result = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null)  // ✅ Only sync non-deleted conversations
          .order('updated_at', { ascending: false })
          .limit(200) as SupabaseQueryResponse<SupabaseConversation[]>; // ✅ SYNC FIX: Increased to 200 for comprehensive sync
        
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
          .limit(30) as SupabaseQueryResponse<SupabaseConversation[]>;
        
        updatedConversations = result.data;
        convError = result.error;
      }
      
      queriesExecuted++; // Track query count
      
      if (convError) {
        // ✅ FIX: Handle connection errors gracefully (don't spam logs)
        const isConnectionError = convError.message?.includes('Failed to fetch') || 
                                  convError.message?.includes('ERR_CONNECTION_CLOSED') ||
                                  convError.message?.includes('NetworkError');
        
        if (isConnectionError) {
          logger.debug('[ConversationSync] ⚠️ Connection error (will retry on next sync):', convError.message);
        } else {
          logger.error('[ConversationSync] ❌ Failed to fetch conversations:', convError);
        }
        return;
      }
      
      conversationsSynced = updatedConversations?.length || 0;
      
      // ✅ OPTIMIZED: Only log if there are changes or it's full sync (reduce log spam)
      if (conversationsSynced > 0 || shouldForceFullSync || import.meta.env.DEV) {
        logger.info('[ConversationSync] Sync results', {
          found: conversationsSynced,
          userId: userId.slice(0, 8) + '...',
          lastSyncedAt,
          isFirstSync: shouldForceFullSync,
          localCount: localConversationCount,
          queryType: shouldForceFullSync ? 'FULL_SYNC' : 'DELTA_SYNC'
        });
      }
      
      // ✅ DIAGNOSTIC: If no conversations found, check if any exist at all
      if (conversationsSynced === 0 && shouldForceFullSync) {
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
            (allConversations as SupabaseConversation[]).map((c: SupabaseConversation) => ({ id: c.id, title: c.title, deleted: !!c.deleted_at }))
          );
        } else {
          logger.info('[ConversationSync] 📋 No conversations found in Supabase at all');
        }
      }
      
      logger.debug(`[ConversationSync] ✅ Found ${conversationsSynced} updated conversations`);
      logger.debug('[ConversationSync] 📥 Syncing conversations...');
      
      // 3. Sync updated conversations to local (add new ones, update existing ones)
      // ✅ CRITICAL: Only sync non-deleted conversations (already filtered by query)
      for (const conv of updatedConversations || []) {
        // ✅ CRITICAL: Double-check deleted_at (defense in depth)
        if (conv.deleted_at) {
          logger.debug('[ConversationSync] ⚠️ Skipping deleted conversation:', conv.id);
          // Mark as deleted locally if it exists
          const localExists = await atlasDB.conversations.get(conv.id);
          if (localExists && !localExists.deletedAt) {
            await atlasDB.conversations.update(conv.id, {
              deletedAt: conv.deleted_at
            });
            logger.debug('[ConversationSync] ✅ Marked conversation as deleted locally:', conv.id);
          }
          continue;
        }
        
        // ✅ CRITICAL: Check if conversation exists locally first
        const localExists = await atlasDB.conversations.get(conv.id);
        
        if (localExists) {
          // ✅ CRITICAL: If locally deleted but remotely not deleted, restore it
          if (localExists.deletedAt && !conv.deleted_at) {
            logger.debug('[ConversationSync] 🔄 Restoring conversation that was deleted locally but not remotely:', conv.id);
            await atlasDB.conversations.update(conv.id, {
              deletedAt: undefined,
              title: conv.title,
              updatedAt: conv.updated_at,
            });
            logger.debug('[ConversationSync] ✅ Restored conversation:', conv.id);
          } else if (!localExists.deletedAt) {
            // Update existing non-deleted conversation
            await atlasDB.conversations.put({
              id: conv.id,
              userId: conv.user_id,
              title: conv.title,
              createdAt: conv.created_at,
              updatedAt: conv.updated_at,
              deletedAt: undefined, // Ensure it's not marked as deleted
            });
            logger.debug('[ConversationSync] ✅ Updated existing conversation:', conv.id);
          }
        } else {
          // ✅ ADD NEW CONVERSATION: Only if not deleted
          await atlasDB.conversations.put({
            id: conv.id,
            userId: conv.user_id,
            title: conv.title,
            createdAt: conv.created_at,
            updatedAt: conv.updated_at,
            deletedAt: undefined, // Ensure it's not marked as deleted
          });
          logger.debug('[ConversationSync] ✅ Added new conversation:', conv.id, 'title:', conv.title);
        }
      }
      
      // ✅ CRITICAL FIX: Sync deletion markers (tombstone sync)
      // Check for conversations that were deleted remotely but we haven't synced yet
      // We need to fetch deleted conversations separately to sync deletion markers
      if (!shouldForceFullSync) {
        // Fetch recently deleted conversations (within sync window)
        const { data: deletedConversations, error: deletedError } = await supabase
          .from('conversations')
          .select('id, deleted_at, updated_at')
          .eq('user_id', userId)
          .not('deleted_at', 'is', null)  // Only deleted conversations
          .gt('updated_at', lastSyncedAt)  // Only recently deleted
          .limit(20) as SupabaseQueryResponse<Pick<SupabaseConversation, 'id' | 'deleted_at' | 'updated_at'>[]>; // ✅ SCALABILITY FIX: Reduced from 50 to 20
        
        if (!deletedError && deletedConversations && deletedConversations.length > 0) {
          logger.debug(`[ConversationSync] ✅ Found ${deletedConversations.length} deleted conversations to sync`);
          
          for (const deletedConv of deletedConversations) {
            const localExists = await atlasDB.conversations.get(deletedConv.id);
            if (localExists && !localExists.deletedAt) {
              // Mark as deleted locally
              await atlasDB.conversations.update(deletedConv.id, {
                deletedAt: deletedConv.deleted_at
              });
              
              // Mark all messages as deleted
              const messages = await atlasDB.messages
                .where('conversationId')
                .equals(deletedConv.id)
                .toArray();
              
              for (const msg of messages) {
                await atlasDB.messages.update(msg.id, {
                  deletedAt: deletedConv.deleted_at
                });
              }
              
              logger.debug('[ConversationSync] ✅ Synced deletion marker for conversation:', deletedConv.id);
            }
          }
        }
      }
      
      // ✅ FIX Z: Sync messages for conversations that don't have messages yet
      // Ensures Dexie.messages is hydrated before UI loads (parent-child sync pattern)
      // This fixes root cause: conversations sync but messages don't, leaving UI blank
      // CRITICAL: Only sync messages for conversations that don't already have messages in Dexie
      // This prevents interfering with conversations that already have messages loaded
      if (shouldForceFullSync || messagesSynced === 0) {
        const allSyncedConversations = await atlasDB.conversations
          .where('userId')
          .equals(userId)
          .filter(conv => !conv.deletedAt)
          .toArray();
        
        if (allSyncedConversations.length > 0) {
          // Check which conversations need message sync (don't have messages in Dexie)
          const conversationsNeedingSync: string[] = [];
          for (const conv of allSyncedConversations) {
            const messageCount = await atlasDB.messages
              .where('conversationId')
              .equals(conv.id)
              .count();
            
            if (messageCount === 0) {
              conversationsNeedingSync.push(conv.id);
            }
          }
          
          if (conversationsNeedingSync.length > 0) {
            logger.debug(`[ConversationSync] 🔄 FIX Z: Syncing messages for ${conversationsNeedingSync.length}/${allSyncedConversations.length} conversations without messages...`);
            
            // Batch sync (5 at a time) to avoid overwhelming system
            const BATCH_SIZE = 5;
            for (let i = 0; i < conversationsNeedingSync.length; i += BATCH_SIZE) {
              const batch = conversationsNeedingSync.slice(i, i + BATCH_SIZE);
              await Promise.all(
                batch.map(async (convId) => {
                  try {
                    await this.syncMessagesFromRemote(convId, userId);
                  } catch (error) {
                    logger.warn(`[ConversationSync] ⚠️ FIX Z: Failed to sync messages for ${convId}:`, error);
                    // Non-blocking - continue with other conversations
                  }
                })
              );
            }
            
            logger.debug(`[ConversationSync] ✅ FIX Z: Completed message sync for ${conversationsNeedingSync.length} conversations`);
          } else {
            logger.debug(`[ConversationSync] ⏭️ FIX Z: All conversations already have messages, skipping sync`);
          }
        }
      } else {
        logger.debug(`[ConversationSync] ⏭️ FIX Z: Skipping (delta sync already synced ${messagesSynced} messages)`);
      }
      
      // ✅ CRITICAL: Wait for all Dexie writes to complete before returning
      // This ensures messages are in Dexie before ChatPage tries to load them
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 4. Fetch ONLY messages for updated conversations
      if (updatedConversations && updatedConversations.length > 0) {
        const conversationIds = updatedConversations.map(c => c.id);
        
        const { data: newMessages, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .in('conversation_id', conversationIds)  // ← ONLY updated conversations
          .gt('created_at', lastSyncedAt)  // ← DELTA FILTER
          .order('created_at', { ascending: true })
          .limit(20) as SupabaseQueryResponse<SupabaseMessage[]>; // ✅ SCALABILITY FIX: Reduced from 100 to 20
        
        queriesExecuted++; // Track query count
        
        if (msgError) {
          // ✅ FIX: Handle connection errors gracefully
          const isConnectionError = msgError.message?.includes('Failed to fetch') || 
                                    msgError.message?.includes('ERR_CONNECTION_CLOSED') ||
                                    msgError.message?.includes('NetworkError');
          
          if (isConnectionError) {
            logger.debug('[ConversationSync] ⚠️ Connection error fetching messages (will retry):', msgError.message);
          } else {
            logger.error('[ConversationSync] ❌ Failed to fetch messages:', msgError);
          }
        } else {
          messagesSynced = newMessages?.length || 0;
          logger.debug(`[ConversationSync] ✅ Found ${messagesSynced} new messages`);
          
          // ✅ PERFORMANCE OPTIMIZATION: Batch IndexedDB operations for faster sync
          // Real-time listener is primary writer; this is for offline catch-up only
          const messagesToAdd: Message[] = [];
          const messagesToUpdate: Array<{ id: string; updates: Partial<Message> }> = [];
          
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
                // Object format (shouldn't happen with SupabaseMessage type, but handle safely)
                parsedContent = typeof msg.content === 'object' && msg.content !== null && 'text' in msg.content
                  ? String((msg.content as { text?: string }).text || '')
                  : String(msg.content || '');
              }
              
              // ✅ PERFORMANCE: Collect messages for batch insert
              messagesToAdd.push({
                id: msg.id,
                conversationId: msg.conversation_id,
                userId: userId, // ✅ Use authenticated userId from function parameter
                role: msg.role,
                type: 'text',
                content: parsedContent, // ✅ FIX: Use parsed content
                timestamp: msg.created_at,
                status: 'sent', // ✅ CRITICAL: Synced messages are already sent
                synced: true,
                updatedAt: msg.created_at,
                deletedAt: msg.deleted_at || undefined, // ✅ PHASE 2: Sync deleted status
                deletedBy: msg.deleted_by || undefined  // ✅ PHASE 2: Sync delete type
              });
            } else if (msg.deleted_at && !existingMsg.deletedAt) {
              // ✅ PERFORMANCE: Collect updates for batch operation
              messagesToUpdate.push({
                id: msg.id,
                updates: {
                  deletedAt: msg.deleted_at,
                  deletedBy: msg.deleted_by || 'user'
                }
              });
            }
            // Silent skip - no console spam
          }
          
          // ✅ PERFORMANCE OPTIMIZATION: Batch insert all messages at once (faster than individual puts)
          if (messagesToAdd.length > 0) {
            await atlasDB.messages.bulkPut(messagesToAdd);
            logger.debug(`[ConversationSync] ✅ Batch added ${messagesToAdd.length} messages`);
          }
          
          // ✅ PERFORMANCE OPTIMIZATION: Batch update deleted status
          if (messagesToUpdate.length > 0) {
            await Promise.all(messagesToUpdate.map(({ id, updates }) => 
              atlasDB.messages.update(id, updates)
            ));
            logger.debug(`[ConversationSync] ✅ Batch updated ${messagesToUpdate.length} message deletion statuses`);
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
          } as SupabaseConversation, {
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
              errorDetails: convError.details,
              errorHint: convError.hint
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
          } as SupabaseMessageInsert, {
            onConflict: 'id' // ✅ Handle duplicate IDs gracefully
          });
        
        if (!error) {
          await atlasDB.messages.update(msg.id, { synced: true });
          logger.debug('[ConversationSync] ✅ Synced message:', msg.id);
            messageSynced = true;
        } else {
            const errorStatus = (error as PostgrestError & { status?: number })?.status || error.code;
            const errorMessage = error.message || String(error);
            const errorCode = error.code;
            const errorDetails = error.details || '';
            
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
                } as SupabaseConversation, { onConflict: 'id' });
              
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
          // ✅ Fetch tier for analytics (non-critical, fails gracefully)
          let tier: string | null = null; // NULL allowed for unknown tiers
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('subscription_tier')
              .eq('id', userId)
              .single();
            tier = profile?.subscription_tier || null;
          } catch {
            // Silent fail - tier not critical for sync monitoring
          }
          
          await supabase.from('usage_logs').insert({
            user_id: userId,
            event: 'delta_sync_completed',
            tier: tier || null, // ✅ Explicit column (best practice) - NULL allowed for unknown tiers
            feature: 'sync',
            metadata: {
              duration,
              queries: queriesExecuted,
              conversationsSynced,
              messagesSynced,
              unsyncedPushed: unsyncedMessages.length
            } as Json
          });
        }
      } catch (logError) {
        // Silent fail - monitoring is optional and non-critical
        logger.debug('[ConversationSync] Monitoring disabled (non-critical)');
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('[ConversationSync] ❌ Delta sync failed after', duration, 'ms:', error);
    } finally {
      // ✅ CRITICAL: Always clear sync flag and debounce timer
      this.syncInProgress = false;
      if (this.syncDebounceTimer) {
        clearTimeout(this.syncDebounceTimer);
        this.syncDebounceTimer = null;
      }
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
