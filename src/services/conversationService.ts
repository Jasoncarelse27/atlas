import { atlasDB, ensureDatabaseReady } from '../database/atlasDB';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';

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
    
    // Use cache if recent and not forcing refresh
    if (!forceRefresh && this.cache.length > 0 && (now - this.lastFetch) < this.CACHE_TTL) {
      logger.debug('[ConversationService] ✅ Using cached conversations');
      return this.cache;
    }

    try {
      // Ensure database is ready (cached internally)
      await ensureDatabaseReady();

      // Load conversations from Dexie
      const allConversations = await atlasDB.conversations
        .where('userId')
        .equals(userId)
        .toArray();
        
      // Sort by updatedAt and limit
      const conversations = allConversations
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 50); // Reasonable limit for performance

      // Transform to consistent format
      this.cache = conversations.map((conv: any) => ({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        userId: conv.userId
      }));

      this.lastFetch = now;
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
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      // Delete from local Dexie
      await atlasDB.conversations.delete(conversationId);
      await atlasDB.messages.where('conversationId').equals(conversationId).delete();

      // Remove from cache
      this.cache = this.cache.filter(conv => conv.id !== conversationId);

      // Delete from remote (Supabase)
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) {
        logger.error('[ConversationService] ❌ Failed to delete from remote:', error);
      }

      logger.debug('[ConversationService] ✅ Conversation deleted:', conversationId);
    } catch (error) {
      logger.error('[ConversationService] ❌ Delete failed:', error);
      throw error;
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
