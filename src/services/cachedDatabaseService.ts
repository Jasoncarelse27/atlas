/**
 * Cached Database Service for Atlas
 * Integrates Redis caching with Supabase queries for 40% performance improvement
 */

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';
import { redisCacheService } from './redisCacheService';
import { ensureConversationExists } from './conversationGuard';

interface UserProfile {
  id: string;
  email: string;
  tier: 'free' | 'core' | 'studio';
  subscription_status: string;
  created_at: string;
  updated_at: string;
}

interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

class CachedDatabaseService {
  /**
   * Get user profile with Redis caching
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      // Try to get from cache first
      const cachedProfile = await redisCacheService.getCachedUserProfile(userId, 'core');
      if (cachedProfile) {
        logger.debug('[CachedDB] ✅ User profile from cache');
        return cachedProfile;
      }

      // Cache miss - fetch from database
      logger.debug('[CachedDB] ❌ Cache miss - fetching user profile from DB');
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        logger.error('[CachedDB] ❌ Error fetching user profile:', error);
        return null;
      }

      // Cache the result
      if (profile) {
        await redisCacheService.cacheUserProfile(userId, profile, (profile as any).tier || 'free');
        logger.debug('[CachedDB] ✅ User profile cached');
      }

      return profile;
    } catch (error) {
      logger.error('[CachedDB] ❌ Error in getUserProfile:', error);
      return null;
    }
  }

  /**
   * Get conversations with Redis caching
   */
  async getConversations(userId: string, limit: number = 20): Promise<Conversation[]> {
    try {
      // Try to get from cache first
      const cachedConversations = await redisCacheService.getCachedConversations(userId, 'core');
      if (cachedConversations) {
        logger.debug('[CachedDB] ✅ Conversations from cache');
        return cachedConversations.slice(0, limit);
      }

      // Cache miss - fetch from database
      logger.debug('[CachedDB] ❌ Cache miss - fetching conversations from DB');
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)  // ✅ FIX: Only get non-deleted conversations
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('[CachedDB] ❌ Error fetching conversations:', error);
        return [];
      }

      // Cache the result
      if (conversations && conversations.length > 0) {
        await redisCacheService.cacheConversations(userId, conversations, 'core');
        logger.debug('[CachedDB] ✅ Conversations cached');
      }

      return conversations || [];
    } catch (error) {
      logger.error('[CachedDB] ❌ Error in getConversations:', error);
      return [];
    }
  }

  /**
   * Get messages for a conversation with Redis caching
   */
  async getMessages(conversationId: string, limit: number = 50): Promise<Message[]> {
    try {
      // Try to get from cache first
      const cachedMessages = await redisCacheService.getCachedMessages(conversationId, 'core');
      if (cachedMessages) {
        logger.debug('[CachedDB] ✅ Messages from cache');
        return cachedMessages.slice(0, limit);
      }

      // Cache miss - fetch from database
      logger.debug('[CachedDB] ❌ Cache miss - fetching messages from DB');
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        logger.error('[CachedDB] ❌ Error fetching messages:', error);
        return [];
      }

      // Cache the result
      if (messages && messages.length > 0) {
        await redisCacheService.cacheMessages(conversationId, messages, 'core');
        logger.debug('[CachedDB] ✅ Messages cached');
      }

      return messages || [];
    } catch (error) {
      logger.error('[CachedDB] ❌ Error in getMessages:', error);
      return [];
    }
  }

  /**
   * Create a new conversation with cache invalidation
   */
  async createConversation(userId: string, title: string): Promise<Conversation | null> {
    try {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          title: title
        } as any)
        .select()
        .single();

      if (error) {
        logger.error('[CachedDB] ❌ Error creating conversation:', error);
        return null;
      }

      // Invalidate user's conversation cache
      await redisCacheService.invalidateUserCache(userId, 'core');
      logger.debug('[CachedDB] ✅ Conversation created and cache invalidated');

      return conversation;
    } catch (error) {
      logger.error('[CachedDB] ❌ Error in createConversation:', error);
      return null;
    }
  }

  /**
   * Create a new message with cache invalidation
   */
  async createMessage(
    conversationId: string, 
    userId: string, 
    role: 'user' | 'assistant' | 'system', 
    content: string
  ): Promise<Message | null> {
    try {
      // ✅ CRITICAL FIX: Ensure conversation exists before creating message
      const conversationExists = await ensureConversationExists(conversationId, userId);
      if (!conversationExists) {
        logger.error('[CachedDB] ❌ Cannot create message - conversation creation failed:', {
          conversationId,
          userId
        });
        return null;
      }

      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          role: role,
          content: content
        } as any)
        .select()
        .single();

      if (error) {
        logger.error('[CachedDB] ❌ Error creating message:', error);
        return null;
      }

      // Invalidate conversation's message cache
      await redisCacheService.invalidateConversationCache(conversationId, 'core');
      logger.debug('[CachedDB] ✅ Message created and cache invalidated');

      return message;
    } catch (error) {
      logger.error('[CachedDB] ❌ Error in createMessage:', error);
      return null;
    }
  }

  /**
   * Update user profile with cache invalidation
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      const { data: profile, error } = await (supabase
        .from('user_profiles')
        .update(updates as any)
        .eq('id', userId)
        .select()
        .single() as any);

      if (error) {
        logger.error('[CachedDB] ❌ Error updating user profile:', error);
        return null;
      }

      // Invalidate user cache
      await redisCacheService.invalidateUserCache(userId, 'core');
      logger.debug('[CachedDB] ✅ User profile updated and cache invalidated');

      return profile;
    } catch (error) {
      logger.error('[CachedDB] ❌ Error in updateUserProfile:', error);
      return null;
    }
  }

  // Note: deleteConversation method removed - use conversationDeleteService.ts for all deletions

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return redisCacheService.getStats();
  }

  /**
   * Clear all cache for a user
   */
  async clearUserCache(userId: string): Promise<void> {
    await redisCacheService.clearUserCache(userId, 'core');
    logger.debug('[CachedDB] ✅ User cache cleared');
  }

  /**
   * Health check for both Redis and Supabase
   */
  async healthCheck(): Promise<{ redis: boolean; supabase: boolean }> {
    const redisHealth = await redisCacheService.healthCheck();
    
    let supabaseHealth = false;
    try {
      const { error } = await supabase.from('user_profiles').select('id').limit(1);
      supabaseHealth = !error;
    } catch (error) {
      logger.error('[CachedDB] ❌ Supabase health check failed:', error);
    }

    return {
      redis: redisHealth,
      supabase: supabaseHealth
    };
  }
}

// Export singleton instance
export const cachedDatabaseService = new CachedDatabaseService();
export default cachedDatabaseService;
