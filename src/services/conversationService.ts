import { atlasDB, ensureDatabaseReady } from '../database/atlasDB';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';
import { redisCacheService } from './redisCacheService';

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

/**
 * ✅ SIMPLE & SCALABLE: Unified conversation service
 * 
 * Single source of truth for conversation operations.
 * Optimized for performance and future-proof.
 */
class ConversationService {
  private static instance: ConversationService;
  private cache: Conversation[] = [];
  private lastFetch = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  static getInstance(): ConversationService {
    if (!ConversationService.instance) {
      ConversationService.instance = new ConversationService();
    }
    return ConversationService.instance;
  }

  /**
   * Get conversations with intelligent caching
   */
  async getConversations(userId: string, forceRefresh = false): Promise<Conversation[]> {
    const now = Date.now();
    
    // Get user tier for cache configuration
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();
      const tier = (profile as any)?.subscription_tier || 'free';
    
    // Try Redis cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cachedConversations = await redisCacheService.getCachedConversations(userId, tier);
      if (cachedConversations) {
        logger.debug('[ConversationService] ✅ Using Redis cached conversations');
        this.cache = cachedConversations;
        this.lastFetch = now;
        return cachedConversations;
      }
    }
    
    // Use in-memory cache if recent and not forcing refresh
    if (!forceRefresh && this.cache.length > 0 && (now - this.lastFetch) < this.CACHE_TTL) {
      logger.debug('[ConversationService] ✅ Using in-memory cached conversations');
      return this.cache;
    }

    try {
      // Ensure database is ready (cached internally)
      await ensureDatabaseReady();

      // ⚡ SCALABILITY FIX: Limit at database level, not in-memory
      // ✅ CRITICAL: Filter out deleted conversations
      const conversations = await atlasDB.conversations
        .where('userId')
        .equals(userId)
        .filter(conv => !conv.deletedAt) // ✅ Filter out soft-deleted conversations
        .reverse() // Most recent first (indexed)
        .limit(50) // Limit BEFORE loading into memory
        .toArray();

      // Transform to consistent format
      this.cache = conversations.map((conv: { id: string; title?: string; user_id: string; created_at: string; updated_at: string; last_message_at?: string; deletedAt?: string }) => ({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        userId: conv.userId
      }));

      this.lastFetch = now;
      
      // Cache in Redis for future requests
      await redisCacheService.cacheConversations(userId, this.cache, tier);
      
      logger.debug(`[ConversationService] ✅ Loaded ${this.cache.length} conversations`);
      
      return this.cache;
    } catch (error) {
      logger.error('[ConversationService] ❌ Failed to load conversations:', error);
      return [];
    }
  }

  /**
   * Refresh conversations (clear cache and reload)
   */
  async refreshConversations(userId: string): Promise<Conversation[]> {
    this.cache = [];
    this.lastFetch = 0;
    return this.getConversations(userId, true);
  }

  /**
   * Delete conversation using soft delete for proper sync
   * Uses soft delete RPC to ensure deletions persist across devices
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    try {
      logger.info(`[ConversationService] 🗑️ Soft deleting conversation: ${conversationId}`);
      
      // ✅ CRITICAL: Use soft delete RPC to set deleted_at timestamp
      // This ensures sync service can properly filter out deleted conversations
      const { error: rpcError } = await supabase.rpc('delete_conversation_soft', {
        p_user: userId,
        p_conversation: conversationId
      });

      if (rpcError) {
        logger.error('[ConversationService] ❌ Soft delete RPC failed:', rpcError);
        throw new Error(`Failed to delete conversation: ${rpcError.message}`);
      }
      
      logger.info('[ConversationService] ✅ Soft deleted from Supabase');

      // 2. Update local Dexie with deletedAt timestamp
      const deletedAt = new Date().toISOString();
      try {
        // Mark conversation as deleted locally
        const existingConv = await atlasDB.conversations.get(conversationId);
        if (existingConv) {
          await atlasDB.conversations.update(conversationId, {
            deletedAt: deletedAt
          });
          logger.info('[ConversationService] ✅ Marked conversation as deleted in local database');
        }
        
        // Mark all messages in conversation as deleted
        const messages = await atlasDB.messages
          .where('conversationId')
          .equals(conversationId)
          .toArray();
        
        for (const msg of messages) {
          await atlasDB.messages.update(msg.id, {
            deletedAt: deletedAt
          });
        }
      } catch (dexieError) {
        logger.warn('[ConversationService] ⚠️ Local update failed (non-critical):', dexieError);
        // Continue - sync will handle it
      }

      // 3. Clear in-memory cache
      this.cache = this.cache.filter(c => c.id !== conversationId);
      
      // ✅ CRITICAL: Invalidate Redis cache
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', userId)
          .single();
        const tier = (profile as any)?.subscription_tier || 'free';
        
        await redisCacheService.invalidateUserCache(userId, tier);
        logger.debug('[ConversationService] ✅ Invalidated Redis cache');
      } catch (cacheError) {
        logger.warn('[ConversationService] ⚠️ Redis cache invalidation failed (non-critical):', cacheError);
      }
      
      // 4. Dispatch event for UI updates
      if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('conversationDeleted', {
        detail: { conversationId }
      }));
      }

      logger.info('[ConversationService] ✅ Conversation soft deleted successfully');
    } catch (error) {
      logger.error('[ConversationService] ❌ Delete failed:', error);
      throw error; // Let UI handle the error
    }
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache = [];
    this.lastFetch = 0;
  }
}

// Export singleton instance
export const conversationService = ConversationService.getInstance();
