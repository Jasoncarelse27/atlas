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
      const conversations = await atlasDB.conversations
        .where('userId')
        .equals(userId)
        .reverse() // Most recent first (indexed)
        .limit(50) // Limit BEFORE loading into memory
        .toArray();

      // Transform to consistent format
      this.cache = conversations.map((conv: any) => ({
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
   * Delete conversation from both local and remote
   * 🚨 CRITICAL FIX: Delete Supabase FIRST to prevent sync from restoring
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    try {
      logger.info(`[ConversationService] 🗑️ Deleting conversation: ${conversationId}`);
      
      // 1. DELETE FROM SUPABASE FIRST (and wait for it!)
      const { error: deleteError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (deleteError) {
        logger.error('[ConversationService] ❌ Supabase delete failed:', deleteError);
        throw new Error(`Failed to delete from database: ${deleteError.message}`);
      }
      
      logger.info('[ConversationService] ✅ Deleted from Supabase');

      // 2. Now delete local (instant)
      try {
        await atlasDB.conversations.delete(conversationId);
        await atlasDB.messages.where('conversationId').equals(conversationId).delete();
        logger.info('[ConversationService] ✅ Deleted from local database');
      } catch (dexieError) {
        logger.warn('[ConversationService] ⚠️ Local delete failed (non-critical):', dexieError);
      }

      // 3. Clear cache
      this.cache = this.cache.filter(c => c.id !== conversationId);
      
      // 4. Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent('conversationDeleted', {
        detail: { conversationId }
      }));

      logger.info('[ConversationService] ✅ Conversation deleted successfully');
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
